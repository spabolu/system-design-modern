import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {checkDoc, checkBannedTerms, checkProject} from './check-docs.mjs';
import {scaffold} from './scaffold-stubs.mjs';

const concept = [
  'TL;DR', 'Why it matters', 'How it works', 'Trade-offs', 'On Azure',
  'Interview tips', 'Further reading',
];
const caseStudy = [
  'TL;DR', 'Requirements', 'Capacity estimates', 'Core entities and API',
  'High-level design', 'Deep dives', 'On Azure', 'Interview tips', 'Further reading',
];
const frontMatter = '---\ntitle: Test page\ndescription: A useful description.\nsidebar_position: 1\n---\n';
const diagram = '\n```mermaid\nflowchart LR\n  Client --> Server\n```\n';

function page(headings = concept, diagrams = ['How it works']) {
  return frontMatter + headings.map((heading) =>
    `\n## ${heading}\n\nExplanation of ${heading}.\n${diagrams.includes(heading) ? diagram : ''}`).join('');
}

function check(source, options = {}) {
  return checkDoc({
    path: 'docs/01-fundamentals/first.md',
    source,
    expectedPosition: 1,
    expectedHeadings: concept,
    diagramSections: ['How it works'],
  }, options);
}

function hasMessage(diagnostics, pattern, severity = 'error') {
  assert.ok(diagnostics.some((item) => item.severity === severity && pattern.test(item.message)),
    JSON.stringify(diagnostics));
}

const registrySource = `## Curriculum

| Level | Folder | Pages, in sidebar order |
| --- | --- | --- |
| 1. Fundamentals | \`docs/01-fundamentals/\` | \`first\`, \`second\` |
| 2. Building blocks | \`docs/02-building-blocks/\` | \`block\` |
| 3. Patterns | \`docs/03-patterns/\` | \`pattern\` |
| 4. Architecting on Azure | \`docs/04-azure/\` | \`azure\` |
| 5. Advanced | \`docs/05-advanced/\` | \`advanced\` |
| 6. Case studies | \`docs/06-case-studies/\` | \`case\` |

## Page templates
`;

function project() {
  return {
    registrySource,
    files: new Map([
      ['templates/concept.md', concept.map((heading) => `## ${heading}`).join('\n')],
      ['templates/case-study.md', caseStudy.map((heading) => `## ${heading}`).join('\n')],
      ['docs/intro.md', `${frontMatter}\nIntroduction.\n`],
      ['docs/01-fundamentals/first.md', page()],
      ['docs/01-fundamentals/second.md', page().replace('sidebar_position: 1', 'sidebar_position: 2')],
      ['docs/02-building-blocks/block.md', page()],
      ['docs/03-patterns/pattern.md', page()],
      ['docs/04-azure/azure.md', page()],
      ['docs/05-advanced/advanced.md', page()],
      ['docs/06-case-studies/case.md', page(caseStudy, ['High-level design', 'On Azure'])],
    ]),
  };
}

test('complete concept and case-study pages pass', async () => {
  assert.deepEqual(check(page()), []);
  assert.deepEqual(await checkProject(project()), []);
});

test('Mermaid syntax errors report the fence line without rejecting valid diagrams', async () => {
  const fixture = project();
  const path = 'docs/intro.md';
  const source = `${frontMatter}
\`\`\`mermaid
flowchart LR
  Client["HTTP client"] --> Server["Azure service"]
\`\`\`
\`\`\`mermaid
sequenceDiagram
  Client->>Server: Request
  Server-->>Client: Response
\`\`\`
\`\`\`mermaid
flowchart LR
  Client[unfinished
\`\`\`
`;
  fixture.files.set(path, source);
  const diagnostics = await checkProject(fixture);
  assert.deepEqual(diagnostics, [{
    path,
    line: 16,
    severity: 'error',
    message: 'Invalid mermaid diagram: Parse error on line 3:',
  }]);
});

test('Mermaid examples nested inside code fences are not parsed', async () => {
  const fixture = project();
  fixture.files.set('docs/intro.md',
    `${frontMatter}\n\`\`\`\`markdown\n\`\`\`mermaid\nnot a diagram\n\`\`\`\n\`\`\`\`\n`);
  assert.deepEqual(await checkProject(fixture), []);
});

for (const [from, to, forbidden] of [
  ['01-fundamentals/first', '../02-building-blocks/block.md', true],
  ['01-fundamentals/first', '../04-azure/azure.md', false],
  ['03-patterns/pattern', '../05-advanced/advanced.md#details', true],
  ['06-case-studies/case', '../05-advanced/advanced.md', false],
  ['04-azure/azure', '../06-case-studies/case.md', false],
  ['intro', '06-case-studies/case.md', false],
  ['03-patterns/pattern', '../01-fundamentals/first.md', false],
  ['01-fundamentals/first', 'second.md', false],
]) {
  test(`link levels ${forbidden ? 'reject' : 'allow'} ${from} linking to ${to}`, async () => {
    const fixture = project();
    const path = `docs/${from}.md`;
    const source = fixture.files.get(path);
    fixture.files.set(path, `${source}\n[Next page](${to})\n`);
    const diagnostics = await checkProject(fixture);
    assert.equal(diagnostics.length, forbidden ? 1 : 0, JSON.stringify(diagnostics));
    if (forbidden) {
      assert.deepEqual(diagnostics[0], {
        path,
        line: source.split('\n').length + 1,
        severity: 'error',
        message: `Link to "${to}" goes to a higher curriculum level (${
          to.includes('02-building-blocks') ? '2. Building blocks' : '5. Advanced'}).`,
      });
    }
  });
}

test('link levels resolve reference links and ignore fenced and inline code examples', async () => {
  const fixture = project();
  const path = 'docs/01-fundamentals/first.md';
  fixture.files.set(path, `${page()}
\`\`\`markdown
[Example](../05-advanced/advanced.md)
\`\`\`
~~~markdown
[Example](../05-advanced/advanced.md)
~~~
\`[Example](../05-advanced/advanced.md)\`
[Advanced][next]

[next]: ../05-advanced/advanced.md "Advanced topic"
`);
  const diagnostics = await checkProject(fixture);
  assert.equal(diagnostics.length, 1, JSON.stringify(diagnostics));
  hasMessage(diagnostics, /higher curriculum level.*5\. Advanced/);
});

test('link levels follow the registry order rather than the numeric folder prefix', async () => {
  const fixture = project();
  const rows = fixture.registrySource.split('\n');
  const fundamentals = rows.findIndex((row) => row.startsWith('| 1.'));
  const advanced = rows.findIndex((row) => row.startsWith('| 5.'));
  [rows[fundamentals], rows[advanced]] = [rows[advanced], rows[fundamentals]];
  fixture.registrySource = rows.join('\n');
  fixture.files.set('docs/01-fundamentals/first.md',
    `${page()}\n[Earlier in registry](../05-advanced/advanced.md)\n`);
  assert.deepEqual(await checkProject(fixture), []);
});

for (const field of ['title', 'description', 'sidebar_position']) {
  test(`frontmatter requires ${field}`, () => {
    hasMessage(check(page().replace(new RegExp(`^${field}:.*\\n`, 'm'), '')),
      new RegExp(field));
  });
}

test('frontmatter must be valid YAML with non-empty text and an integer position', () => {
  hasMessage(check(page().replace('title: Test page', 'title: [broken')), /Invalid YAML/);
  hasMessage(check(page().replace('description: A useful description.', 'description: ""')),
    /description/);
  for (const value of ['"1"', '1.5', 'null']) {
    hasMessage(check(page().replace('sidebar_position: 1', `sidebar_position: ${value}`)),
      /sidebar_position.*integer/);
  }
});

test('intro needs frontmatter but is exempt from concept sections', async () => {
  const fixture = project();
  fixture.files.set('docs/intro.md', 'Introduction without frontmatter.');
  hasMessage(await checkProject(fixture), /Missing YAML frontmatter/);
});

test('missing section is reported', () => {
  hasMessage(check(page(concept.filter((heading) => heading !== 'Trade-offs'))),
    /Expected ## headings.*Trade-offs/);
});

test('out-of-order sections are reported', () => {
  const reordered = [...concept];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  hasMessage(check(page(reordered)), /Expected ## headings in order/);
});

test('extra level-two section is reported', () => {
  hasMessage(check(`${page()}\n## Surprise\n\nExtra text.\n`), /found.*Surprise/);
});

test('headings in backtick and tilde fences do not count as sections', () => {
  for (const fence of ['```', '~~~~']) {
    const source = page().replace('Explanation of Trade-offs.',
      `Explanation of Trade-offs.\n${fence}markdown\n## Not a section\n${fence}\n`);
    assert.deepEqual(check(source), []);
  }
});

test('a shorter or different fence does not close a fenced block', () => {
  const source = page().replace('Explanation of Trade-offs.',
    'Explanation of Trade-offs.\n````markdown\n```\n~~~\n## Not a section\n````\n');
  assert.deepEqual(check(source), []);
});

test('a required section cannot be empty or contain only a guidance comment', () => {
  hasMessage(check(page().replace('Explanation of Trade-offs.', '')), /Trade-offs.*non-empty body text/);
  hasMessage(check(page().replace('Explanation of Trade-offs.', '<!-- Write this later. -->')),
    /Trade-offs.*non-empty body text/);
});

test('a diagram alone does not substitute for explanatory text', () => {
  hasMessage(check(page().replace('Explanation of How it works.', '')),
    /How it works.*non-empty body text/);
});

test('a concept page needs a Mermaid fence in How it works', () => {
  hasMessage(check(page(concept, [])), /How it works.*Mermaid fence/);
  hasMessage(check(page(concept, ['On Azure'])), /How it works.*Mermaid fence/);
});

test('a Mermaid example inside another code fence does not count as a diagram', () => {
  const source = page(concept, []).replace('Explanation of How it works.',
    `Explanation of How it works.\n\`\`\`\`markdown\n${diagram}\n\`\`\`\`\n`);
  hasMessage(check(source), /How it works.*Mermaid fence/);
});

for (const missing of ['High-level design', 'On Azure']) {
  test(`case studies need a Mermaid fence in ${missing}`, async () => {
    const fixture = project();
    fixture.files.set('docs/06-case-studies/case.md',
      page(caseStudy, ['High-level design', 'On Azure'].filter((heading) => heading !== missing)));
    hasMessage(await checkProject(fixture), new RegExp(`${missing}.*Mermaid fence`));
  });
}

test('level five uses the concept template, not the case-study template', async () => {
  const fixture = project();
  fixture.files.set('docs/05-advanced/advanced.md', page(caseStudy, ['High-level design', 'On Azure']));
  hasMessage(await checkProject(fixture), /Expected ## headings.*Why it matters.*How it works/);
});

test('stub warning becomes a strict error and skips content checks', () => {
  const stub = `${frontMatter}\n<!-- stub -->\n${concept.map((heading) => `\n## ${heading}\n`).join('')}`;
  assert.deepEqual(check(stub).map(({severity}) => severity), ['warning']);
  hasMessage(check(stub), /Unfinished page/, 'warning');
  assert.deepEqual(check(stub, {strict: true}).map(({severity}) => severity), ['error']);
  hasMessage(check(stub, {strict: true}), /Unfinished page/);
});

test('stubs still need the required headings in order', () => {
  const stub = `${frontMatter}\n<!-- stub -->\n## TL;DR\n`;
  hasMessage(check(stub), /Expected ## headings in order/);
});

test('stubs still need metadata and the registered position', () => {
  const stub = `${frontMatter}\n<!-- stub -->\n`.replace('sidebar_position: 1', 'sidebar_position: 7');
  hasMessage(check(stub), /sidebar_position must be 1/);
  hasMessage(check(stub.replace('title: Test page', 'title: ""')), /title/);
});

test('Azure-only terms have case-sensitive word boundaries and useful line numbers', () => {
  const diagnostics = checkBannedTerms('docs/example.md', 'Azure is allowed.\nAWS and Amazon S3 are not.');
  assert.deepEqual(diagnostics.map(({line, severity}) => ({line, severity})), [
    {line: 2, severity: 'error'}, {line: 2, severity: 'error'},
  ]);
  hasMessage(diagnostics, /AWS/);
  hasMessage(diagnostics, /Amazon S3/);
  assert.deepEqual(checkBannedTerms('docs/example.md', 'AWSome S3Bucket aws gcp'), []);
});

test('all required competing-cloud terms are forbidden', () => {
  const terms = [
    'AWS', 'Amazon Web Services', 'Amazon S3', 'S3', 'DynamoDB', 'AWS Lambda',
    'EC2', 'SQS', 'SNS', 'Kinesis', 'CloudFront', 'Route 53', 'Aurora', 'Redshift',
    'ElastiCache', 'EKS', 'ECS', 'Fargate', 'GCP', 'Google Cloud', 'BigQuery',
    'Cloud Bigtable', 'Cloud Spanner', 'Cloud Pub/Sub', 'Google Pub/Sub',
    'Firestore', 'Cloud Run', 'GKE', 'Cloudflare', 'Vercel', 'Heroku', 'Netlify',
  ];
  for (const term of terms) {
    hasMessage(checkBannedTerms('docs/example.md', term), /Azure-only rule/);
  }
});

test('paper names and generic pub/sub are allowed', () => {
  assert.deepEqual(checkBannedTerms('docs/example.md',
    'The Dynamo paper, Spanner, Bigtable, and generic pub/sub are allowed.'), []);
});

for (const path of ['docs/intro.md', 'blog/note.md', 'src/pages/index.tsx', 'templates/concept.md']) {
  test(`Azure-only rule covers ${path}, even in a stub`, async () => {
    const fixture = project();
    fixture.files.set(path, `${fixture.files.get(path) ?? ''}\n<!-- stub -->\nAWS`);
    const diagnostics = await checkProject(fixture);
    assert.ok(diagnostics.some((item) => item.path === path && /Azure-only/.test(item.message)));
  });
}

test('a registry slug must have a Markdown file', async () => {
  const fixture = project();
  fixture.files.delete('docs/01-fundamentals/first.md');
  hasMessage(await checkProject(fixture), /Registry page is missing/);
});

test('a doc in a level folder must be registered', async () => {
  const fixture = project();
  fixture.files.set('docs/01-fundamentals/unlisted.md', page());
  hasMessage(await checkProject(fixture), /not registered/);
});

test('unknown level folders and nested unregistered docs are rejected', async () => {
  for (const path of ['docs/07-extra/page.md', 'docs/01-fundamentals/nested/page.md']) {
    const fixture = project();
    fixture.files.set(path, page());
    hasMessage(await checkProject(fixture), /not registered/);
  }
});

test('sidebar_position must match the page order in the registry', async () => {
  const fixture = project();
  fixture.files.set('docs/01-fundamentals/second.md', page());
  hasMessage(await checkProject(fixture), /sidebar_position must be 2.*registry/);
});

test('a missing or malformed registry cannot silently pass', async () => {
  await assert.rejects(checkProject({...project(), registrySource: '# No registry'}), /Curriculum section/);
  await assert.rejects(checkProject({...project(),
    registrySource: registrySource.replace('`docs/01-fundamentals/`', '`elsewhere/`'),
  }), /Invalid curriculum row/);
});

function writeFixture(root, fixture) {
  const files = new Map(fixture.files);
  files.set('CONTRIBUTING.md', fixture.registrySource);
  for (const [path, source] of files) {
    mkdirSync(dirname(join(root, path)), {recursive: true});
    writeFileSync(join(root, path), source);
  }
}

test('CLI prints path and line diagnostics and exits according to severity', () => {
  const root = mkdtempSync(join(tmpdir(), 'system-design-docs-'));
  try {
    const fixture = project();
    fixture.files.set('docs/01-fundamentals/first.md',
      `${frontMatter}\n<!-- stub -->\n${concept.map((heading) => `\n## ${heading}\n`).join('')}`);
    writeFixture(root, fixture);
    const script = fileURLToPath(new URL('./check-docs.mjs', import.meta.url));
    const normal = spawnSync(process.execPath, [script], {cwd: root, encoding: 'utf8'});
    assert.equal(normal.status, 0, normal.stderr);
    assert.match(normal.stdout, /docs\/01-fundamentals\/first.md:7: warning: Unfinished page/);
    assert.match(normal.stdout, /8 docs checked: 0 errors, 1 warnings/);
    const strict = spawnSync(process.execPath, [script, '--strict'], {cwd: root, encoding: 'utf8'});
    assert.equal(strict.status, 1, strict.stderr);
    assert.match(strict.stdout, /first.md:7: error: Unfinished page/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('scaffold follows the registry and never overwrites an existing file', () => {
  const root = mkdtempSync(join(tmpdir(), 'system-design-scaffold-'));
  try {
    writeFixture(root, {registrySource, files: new Map([
      ['templates/concept.md', concept.map((heading) => `## ${heading}`).join('\n')],
      ['templates/case-study.md', caseStudy.map((heading) => `## ${heading}`).join('\n')],
    ])});
    scaffold(root);
    const path = join(root, 'docs/01-fundamentals/first.md');
    assert.match(readFileSync(path, 'utf8'), /<!-- stub -->/);
    assert.match(readFileSync(join(root, 'docs/01-fundamentals/second.md'), 'utf8'),
      /sidebar_position: 2/);
    assert.match(readFileSync(join(root, 'docs/06-case-studies/case.md'), 'utf8'),
      /## High-level design/);
    writeFileSync(path, 'A finished page must survive.');
    const category = join(root, 'docs/01-fundamentals/_category_.json');
    writeFileSync(category, '{"label":"Custom label"}');
    scaffold(root);
    assert.equal(readFileSync(path, 'utf8'), 'A finished page must survive.');
    assert.equal(readFileSync(category, 'utf8'), '{"label":"Custom label"}');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
