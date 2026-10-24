export function parseCurriculum(source) {
  const section = source.split(/^## Curriculum\s*$/m)[1]?.split(/^## /m)[0];
  if (!section) {
    throw new Error('CONTRIBUTING.md must contain a Curriculum section');
  }

  const levels = section.split('\n')
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

export function markdownSections(source) {
  const sections = [];
  const ancestors = [];
  let fence;
  for (const [index, line] of source.split('\n').entries()) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] &&
          marker[1].length >= fence.length && marker[2].trim() === '') {
        fence = undefined;
      }
    } else if (marker) {
      fence = marker[1];
    } else {
      const heading = line.match(/^ {0,3}(#{2,4})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/);
      if (heading) {
        const depth = heading[1].length;
        while (ancestors.length && ancestors.at(-1).depth >= depth) ancestors.pop();
        for (const ancestor of ancestors) ancestor.body.push(line);
        const section = {heading: heading[2], depth, line: index + 1, body: [], children: []};
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
    for (const ancestor of ancestors) ancestor.body.push(line);
  }
  return sections;
}
