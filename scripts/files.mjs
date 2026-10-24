import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';

export function readTextFiles(root, entries) {
  const files = new Map();
  function visit(path) {
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory()) {
      for (const entry of readdirSync(path).sort()) visit(join(path, entry));
      return;
    }
    const content = readFileSync(path);
    if (!content.includes(0)) {
      files.set(relative(root, path).split(sep).join('/'), content.toString('utf8'));
    }
  }
  for (const entry of entries) visit(join(root, entry));
  return files;
}
