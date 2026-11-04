import {fromMarkdown} from 'mdast-util-from-markdown';
import {math} from 'micromark-extension-math';
import {mathFromMarkdown} from 'mdast-util-math';
import {gfmTable} from 'micromark-extension-gfm-table';
import {gfmTableFromMarkdown} from 'mdast-util-gfm-table';

const levelRules = {
  'docs/01-fundamentals': {
    description: 'Learn the vocabulary and constraints behind a system design.',
  },
  'docs/02-building-blocks': {
    description: 'Understand the components that store, move, and serve data.',
  },
  'docs/03-patterns': {
    description: 'Combine building blocks to solve recurring design problems.',
  },
  'docs/04-azure': {
    description: 'Choose Azure services and design for reliability, security, and cost.',
    linksToAnyLevel: true,
    linkedFromAnyLevel: true,
  },
  'docs/05-advanced': {
    description: 'Reason about coordination, global systems, and AI workloads.',
  },
  'docs/06-case-studies': {
    description: 'Apply the curriculum to complete designs with explicit trade-offs.',
    template: 'case-study',
    linksToAnyLevel: true,
  },
  'docs/07-papers': {
    description: 'Break down influential papers and articles, then apply their ideas to real problems.',
    template: 'paper',
    linksToAnyLevel: true,
  },
};

export function parseMarkdown(source, {tables = true} = {}) {
  return fromMarkdown(source, {
    extensions: [math(), ...(tables ? [gfmTable()] : [])],
    mdastExtensions: [mathFromMarkdown(), ...(tables ? [gfmTableFromMarkdown()] : [])],
  });
}

export function parseCurriculum(source) {
  const section = source.split(/^## Curriculum\s*$/m)[1]?.split(/^## /m)[0];
  if (!section) {
    throw new Error('CONTRIBUTING.md must contain a Curriculum section');
  }

  const levels = section.split(/\r?\n/)
    .filter((line) => /^\|\s*\d+\./.test(line))
    .map((line) => {
      const [, label, folderCell, pagesCell] = line.split('|').map((cell) => cell.trim());
      const number = Number(label.match(/^\d+/)[0]);
      const folder = folderCell.match(/^`(docs\/\d{2}-[a-z-]+)\/`$/)?.[1];
      const slugs = [...pagesCell.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]);
      if (!folder || slugs.length === 0 || new Set(slugs).size !== slugs.length) {
        throw new Error(`Invalid curriculum row for ${label}`);
      }
      return {
        number,
        label,
        folder,
        template: 'concept',
        linksToAnyLevel: false,
        linkedFromAnyLevel: false,
        ...levelRules[folder],
        pages: slugs.map((slug, index) => ({slug, position: index + 1})),
      };
    });

  if (levels.length === 0 || new Set(levels.map(({folder}) => folder)).size !== levels.length) {
    throw new Error('Curriculum must contain distinct level folders');
  }
  return levels;
}

export function sectionHeadings(source) {
  return markdownSections(source).map(({heading}) => heading);
}

export function markdownSections(source, document = parseMarkdown(source)) {
  const sections = [];
  const ancestors = [];
  const lines = source.split(/\r?\n/);
  const closeSection = (end) => {
    const section = ancestors.pop();
    section.body = lines.slice(section.line, end);
  };
  const noteOpening = (text) => {
    const current = ancestors.at(-1);
    if (current && current.opening === null) current.opening = text;
  };
  for (const node of document.children) {
    const index = node.position.start.line - 1;
    const text = lines.slice(index, node.position.end.line).join('\n').trim();
    if (node.type === 'heading') {
      const heading = lines[index].match(/^ {0,3}(#{2,4})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/);
      if (heading) {
        const depth = heading[1].length;
        while (ancestors.length && ancestors.at(-1).depth >= depth) closeSection(index);
        noteOpening(text);
        const section = {
          heading: heading[2], depth, line: index + 1, body: [], children: [], paragraphs: [], opening: null,
        };
        if (depth === 2) {
          sections.push(section);
        } else if (ancestors.length) {
          ancestors.at(-1).children.push(section);
        } else {
          continue;
        }
        ancestors.push(section);
        continue;
      }
    }
    if (!(node.type === 'html' && text.startsWith('<!--'))) noteOpening(text);
    if (node.type === 'paragraph') {
      for (const ancestor of ancestors) ancestor.paragraphs.push(text);
    }
  }
  while (ancestors.length) closeSection(lines.length);
  return sections;
}
