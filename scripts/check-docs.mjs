import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {posix, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fromMarkdown} from 'mdast-util-from-markdown';
import {parseCurriculum, markdownSections, sectionHeadings} from './curriculum.mjs';
import {readTextFiles} from './files.mjs';
import {parseMermaid} from './mermaid.mjs';

const {load, JSON_SCHEMA} = createRequire(import.meta.url)('js-yaml');

export const bannedTerms = [
  'AWS', 'Amazon Web Services', 'Amazon S3', 'AWS S3', 'S3 bucket', 'S3 buckets',
  'S3 API', 'S3-compatible', 'DynamoDB', 'AWS Lambda',
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

const caseStudySectionRules = {
  'High-level design'(section, report) {
    const steps = section.children.filter(({depth}) => depth === 3);
    if (steps.length === 0) {
      report(section, 'Section "## High-level design" needs at least one ### heading.');
    }
    for (const [index, step] of steps.entries()) {
      if (step.heading === 'Data flow') {
        if (index !== 0) report(step, '"### Data flow" must be the first ### in High-level design.');
      } else if (!sectionContent(step.body).mermaid) {
        report(step, `High-level design "${step.heading}" needs a Mermaid fence (\`\`\`mermaid).`);
      }
    }
  },
  'Deep dives'(section, report) {
    const dives = section.children.filter(({depth}) => depth === 3);
    if (dives.length < 2) {
      report(section, 'Section "## Deep dives" needs at least two ### headings.');
    }
    for (const dive of dives) {
      const solutions = [];
      for (const rung of dive.children.filter(({depth}) => depth === 4)) {
        const match = rung.heading.match(/^(Bad|Good|Great) solution: .+/);
        if (!match) {
          report(rung, `Deep dive "${dive.heading}" needs a rung heading like "#### Good solution: <name>" instead of "#### ${rung.heading}".`);
          continue;
        }
        solutions.push({section: rung, rank: ['Bad', 'Good', 'Great'].indexOf(match[1])});
      }
      if (solutions.length < 2) {
        report(dive, `Deep dive "${dive.heading}" needs at least two rung headings like "#### Good solution: <name>".`);
      }
      for (const [index, {section: rung, rank}] of solutions.entries()) {
        if (index > 0 && rank < solutions[index - 1].rank) {
          report(rung, `Deep dive "${dive.heading}" must keep rungs in Bad, Good, Great order without descending.`);
        }
        for (const label of ['Approach', 'Challenges']) {
          if (!rung.paragraphs.some((text) => text.startsWith(`**${label}.**`))) {
            report(rung, `Rung "${rung.heading}" in deep dive "${dive.heading}" needs a paragraph starting with **${label}.**.`);
          }
        }
      }
      const last = solutions.at(-1);
      if (last?.rank === 0) {
        report(last.section, `Deep dive "${dive.heading}" must end on Good or Great, not Bad.`);
      }
    }
  },
  'What is expected at each level'(section, report) {
    const expected = ['Mid-level', 'Senior', 'Staff+'];
    const levels = section.children.filter(({depth}) => depth === 3);
    const mismatch = levels.find((level, index) => level.heading !== expected[index]);
    if (mismatch || levels.length !== expected.length) {
      report(mismatch ?? section,
        'Section "## What is expected at each level" needs exactly ### Mid-level, ### Senior, and ### Staff+ in that order.');
    }
    for (const level of levels) {
      if (!sectionContent(level.body).text) {
        report(level, `Level "### ${level.heading}" needs non-empty body text.`);
      }
    }
  },
};

export function checkDoc({
  path, source, expectedPosition, expectedHeadings, diagramSections = [],
  pageType = 'concept', document,
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
  const sections = markdownSections(body, document);
  const actual = sections.map(({heading}) => heading);
  const headingsMatch = JSON.stringify(actual) === JSON.stringify(expectedHeadings);
  if (!headingsMatch) {
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
    if (pageType === 'case-study' && headingsMatch) {
      caseStudySectionRules[section.heading]?.(section,
        (heading, message) => diagnostics.push(error(path, heading.line, message)));
    }
  }
  return diagnostics;
}

export async function checkProject({registrySource, files}, {strict = false} = {}) {
  const levels = parseCurriculum(registrySource).map((level, order) => ({...level, order}));
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
    const level = levels.find(({folder}) => path.startsWith(`${folder}/`));
    const links = [];
    const definitions = new Map();
    const visit = (node) => {
      if (node.type === 'code' && node.lang === 'mermaid') {
        diagrams.push({path, line: node.position.start.line, source: node.value});
      }
      if (node.type === 'link' || node.type === 'linkReference') links.push(node);
      if (node.type === 'definition') definitions.set(node.identifier, node.url);
      node.children?.forEach(visit);
    };
    const document = fromMarkdown(source);
    visit(document);
    if (level && level.number !== 6 && level.folder !== 'docs/04-azure') {
      for (const link of links) {
        const url = link.url ?? definitions.get(link.identifier);
        if (!url || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(url)) continue;
        const destination = url.split(/[?#]/)[0];
        if (!destination.endsWith('.md')) continue;
        const targetPath = posix.join(posix.dirname(path), destination);
        const target = levels.find(({folder}) => targetPath.startsWith(`${folder}/`));
        if (target && target.folder !== 'docs/04-azure' && target.order > level.order) {
          diagnostics.push(error(path, link.position.start.line,
            `Link to "${url}" goes to a higher curriculum level (${target.label}).`));
        }
      }
    }
    if (/^docs\/\d{2}-[^/]+\//.test(path) && !registry.has(path)) {
      diagnostics.push(error(path, 1, 'Doc file is not registered in the curriculum.'));
    }
    const templateName = level?.number === 6 ? 'case-study' : 'concept';
    diagnostics.push(...checkDoc({
      path,
      source,
      expectedPosition: registry.get(path),
      expectedHeadings: level ? templates.get(templateName) : undefined,
      diagramSections: level?.number === 6 ? ['On Azure'] : ['How it works'],
      pageType: templateName,
      document,
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
