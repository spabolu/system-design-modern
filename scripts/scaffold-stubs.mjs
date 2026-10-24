import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve, basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseCurriculum, sectionHeadings} from './curriculum.mjs';

const descriptions = [
  'Learn the vocabulary and constraints behind a system design.',
  'Understand the components that store, move, and serve data.',
  'Combine building blocks to solve recurring design problems.',
  'Choose Azure services and design for reliability, security, and cost.',
  'Reason about coordination, global systems, and AI workloads.',
  'Apply the curriculum to complete designs with explicit trade-offs.',
];

function pageTitle(slug) {
  const names = {
    api: 'API', ai: 'AI', azure: 'Azure', cap: 'CAP', cdn: 'CDN',
    cqrs: 'CQRS', crdts: 'CRDTs', llm: 'LLM', nosql: 'NoSQL',
    paxos: 'Paxos', raft: 'Raft', rag: 'RAG', sql: 'SQL', url: 'URL',
  };
  const title = slug.split('-').map((word) => names[word] ?? word).join(' ');
  return title[0].toUpperCase() + title.slice(1);
}

export function scaffold(root) {
  const levels = parseCurriculum(readFileSync(resolve(root, 'CONTRIBUTING.md'), 'utf8'));
  const templates = Object.fromEntries(['concept', 'case-study'].map((name) => [
    name, sectionHeadings(readFileSync(resolve(root, `templates/${name}.md`), 'utf8')),
  ]));
  let created = 0;
  let skipped = 0;
  function createMissing(path, content) {
    try {
      writeFileSync(resolve(root, path), content, {flag: 'wx'});
      created += 1;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      skipped += 1;
    }
  }

  for (const level of levels) {
    mkdirSync(resolve(root, level.folder), {recursive: true});
    createMissing(`${level.folder}/_category_.json`, `${JSON.stringify({
      label: level.label,
      position: level.number + 1,
      link: {
        type: 'generated-index',
        slug: `/${basename(level.folder)}`,
        description: descriptions[level.number - 1],
      },
    }, null, 2)}\n`);

    const headings = templates[level.number === 6 ? 'case-study' : 'concept'];
    for (const {slug, position} of level.pages) {
      const title = pageTitle(slug);
      createMissing(`${level.folder}/${slug}.md`, [
        '---',
        `title: ${JSON.stringify(title)}`,
        `description: ${JSON.stringify(`Planned curriculum page about ${title}.`)}`,
        `sidebar_position: ${position}`,
        '---',
        '',
        '<!-- stub -->',
        '',
        ...headings.flatMap((heading) => [`## ${heading}`, '']),
      ].join('\n'));
    }
  }
  return {created, skipped};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {created, skipped} = scaffold(process.cwd());
  console.log(`Scaffold: ${created} files created, ${skipped} existing files left unchanged.`);
}
