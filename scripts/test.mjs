import {readdirSync} from 'node:fs';

for (const file of readdirSync(new URL('.', import.meta.url)).sort()) {
  if (file.endsWith('.test.mjs')) await import(new URL(file, import.meta.url));
}
