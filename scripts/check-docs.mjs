import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fromMarkdown} from 'mdast-util-from-markdown';
import {parseCurriculum, markdownSections, sectionHeadings} from './curriculum.mjs';
import {readTextFiles} from './files.mjs';
import {parseMermaid} from './mermaid.mjs';

const {load, JSON_SCHEMA} = createRequire(import.meta.url)('js-yaml');

export const bannedTerms = [
  'AWS', 'Amazon Web Services', 'Amazon S3', 'S3', 'DynamoDB', 'AWS Lambda',
  'EC2', 'SQS', 'SNS', 'Kinesis', 'CloudFront', 'Route 53', 'Aurora',
  'Redshift', 'ElastiCache', 'EKS', 'ECS', 'Fargate', 'GCP', 'Google Cloud',
  'BigQuery', 'Cloud Bigtable', 'Cloud Spanner', 'Cloud Pub/Sub',
  'Google Pub/Sub', 'Firestore', 'Cloud Run', 'GKE', 'Cloudflare',
  'Vercel', 'Heroku', 'Netlify',
];

const bannedPattern = new RegExp(`\\b(?:${[...bannedTerms]
  .sort((a, b) => b.length - a.length)
  .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')})\\b`, 'g');
const frontMatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const lineAt = (source, offset) => source.slice(0, offset).split('\n').length;
const error = (path, line, message) => ({path, line, severity: 'error', message});

export function checkBannedTerms(path, source) {
  return [...source.matchAll(bannedPattern)].map((match) =>
    error(path, lineAt(source, match.index), `Azure-only rule forbids "${match[0]}".`));
}

function sectionContent(lines) {
  let fence;
  let mermaid = false;
  const text = [];
  for (const line of lines) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] &&
          marker[1].length >= fence.length && marker[2].trim() === '') {
        fence = undefined;
      }
    } else if (marker) {
      fence = marker[1];
      if (marker[1][0] === '`' && /^mermaid(?:\s|$)/.test(marker[2].trim())) {
        mermaid = true;
      }
    } else {
      text.push(line);
    }
  }
  return {
    mermaid,
    text: text.join('\n').replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^ {0,3}#{1,6}\s.*$/gm, '').trim(),
  };
}

export function checkDoc({
  path, source, expectedPosition, expectedHeadings, diagramSections = [],
}, {strict = false} = {}) {
  const diagnostics = [];
  const frontMatter = source.match(frontMatterPattern);
  let metadata = {};
  if (!frontMatter) {
    diagnostics.push(error(path, 1, 'Missing YAML frontmatter.'));
  } else {
    try {
      const parsed = load(frontMatter[1], {schema: JSON_SCHEMA});
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Frontmatter must be a mapping.');
      }
      metadata = parsed;
    } catch (cause) {
      diagnostics.push(error(path, (cause.mark?.line ?? 0) + 2,
        `Invalid YAML frontmatter: ${cause.message}`));
    }
  }

  const fieldLine = (key) => {
    const index = frontMatter?.[0].search(new RegExp(`^${key}:`, 'm'));
    return index === undefined || index < 0 ? 1 : lineAt(source, index);
  };
  for (const key of ['title', 'description']) {
    if (typeof metadata[key] !== 'string' || !metadata[key].trim()) {
      diagnostics.push(error(path, fieldLine(key), `Frontmatter "${key}" must be a non-empty string.`));
    }
  }
  if (!Number.isInteger(metadata.sidebar_position)) {
    diagnostics.push(error(path, fieldLine('sidebar_position'),
      'Frontmatter "sidebar_position" must be an integer.'));
  } else if (expectedPosition !== undefined && metadata.sidebar_position !== expectedPosition) {
    diagnostics.push(error(path, fieldLine('sidebar_position'),
      `sidebar_position must be ${expectedPosition} to match the curriculum registry.`));
  }

  const stub = source.includes('<!-- stub -->');
  if (stub) {
    diagnostics.push({
      path,
      line: lineAt(source, source.indexOf('<!-- stub -->')),
      severity: strict ? 'error' : 'warning',
      message: 'Unfinished page contains <!-- stub -->.',
    });
  }
  if (!expectedHeadings) return diagnostics;

  const body = source.replace(frontMatterPattern, (match) => match.replace(/[^\n]/g, ''));
  const sections = markdownSections(body);
  const actual = sections.map(({heading}) => heading);
  if (JSON.stringify(actual) !== JSON.stringify(expectedHeadings)) {
    diagnostics.push(error(path, sections[0]?.line ?? 1,
      `Expected ## headings in order [${expectedHeadings.join(', ')}]; found [${actual.join(', ')}].`));
  }
  if (stub) return diagnostics;
  for (const section of sections) {
    if (!expectedHeadings.includes(section.heading)) continue;
    const content = sectionContent(section.body);
    if (!content.text) {
      diagnostics.push(error(path, section.line, `Section "## ${section.heading}" needs non-empty body text.`));
    }
    if (diagramSections.includes(section.heading) && !content.mermaid) {
      diagnostics.push(error(path, section.line, `Section "## ${section.heading}" needs a Mermaid fence (\`\`\`mermaid).`));
    }
  }
  return diagnostics;
}

export async function checkProject({registrySource, files}, {strict = false} = {}) {
  const levels = parseCurriculum(registrySource);
  const diagnostics = [];
  const diagrams = [];
  const templates = new Map();
  for (const name of ['concept', 'case-study']) {
    const path = `templates/${name}.md`;
    const template = files.get(path);
    if (!template || sectionHeadings(template).length === 0) {
      diagnostics.push(error(path, 1, 'Missing template or required ## headings.'));
    } else {
      templates.set(name, sectionHeadings(template));
    }
  }
  const registry = new Map();
  for (const level of levels) {
    for (const {slug, position} of level.pages) {
      const path = `${level.folder}/${slug}.md`;
      registry.set(path, position);
      if (!files.has(path)) {
        diagnostics.push(error(path, 1, 'Registry page is missing its Markdown file.'));
      }
    }
  }
  for (const [path, source] of files) {
    if (/^(docs|blog|src|templates)\//.test(path)) {
      diagnostics.push(...checkBannedTerms(path, source));
    }
    if (!/^docs\/.*\.mdx?$/.test(path)) continue;
    const visit = (node) => {
      if (node.type === 'code' && node.lang === 'mermaid') {
        diagrams.push({path, line: node.position.start.line, source: node.value});
      }
      node.children?.forEach(visit);
    };
    visit(fromMarkdown(source));
    const level = levels.find(({folder}) => path.startsWith(`${folder}/`));
    if (/^docs\/\d{2}-[^/]+\//.test(path) && !registry.has(path)) {
      diagnostics.push(error(path, 1, 'Doc file is not registered in the curriculum.'));
    }
    const templateName = level?.number === 6 ? 'case-study' : 'concept';
    diagnostics.push(...checkDoc({
      path,
      source,
      expectedPosition: registry.get(path),
      expectedHeadings: level ? templates.get(templateName) : undefined,
      diagramSections: level?.number === 6 ? ['High-level design', 'On Azure'] : ['How it works'],
    }, {strict}));
  }
  const diagramDiagnostics = await Promise.all(diagrams.map(async ({path, line, source}) => {
    const message = await parseMermaid(source);
    return message ? error(path, line, `Invalid mermaid diagram: ${message}`) : undefined;
  }));
  diagnostics.push(...diagramDiagnostics.filter(Boolean));
  return diagnostics;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = process.cwd();
    const files = readTextFiles(root, ['docs', 'blog', 'src', 'templates']);
    const diagnostics = await checkProject({
      registrySource: readFileSync(resolve(root, 'CONTRIBUTING.md'), 'utf8'), files,
    }, {strict: process.argv.includes('--strict')});
    for (const {path, line, severity, message} of diagnostics) {
      console.log(`${path}:${line}: ${severity}: ${message}`);
    }
    const errors = diagnostics.filter(({severity}) => severity === 'error').length;
    const warnings = diagnostics.length - errors;
    const docs = [...files.keys()].filter((path) => /^docs\/.*\.mdx?$/.test(path)).length;
    console.log(`${docs} docs checked: ${errors} errors, ${warnings} warnings.`);
    process.exitCode = errors > 0 ? 1 : 0;
  } catch (cause) {
    console.error(`scripts/check-docs.mjs:1: error: ${cause.message}`);
    console.error('Docs check failed.');
    process.exitCode = 1;
  }
}
