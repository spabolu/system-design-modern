import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {loadFreshModule} = require('@docusaurus/utils');
const rendererRequire = createRequire(require.resolve('rehype-katex'));

test('KaTeX stylesheet version and integrity match the installed math renderer', async () => {
  const config = await loadFreshModule(fileURLToPath(new URL('../docusaurus.config.ts', import.meta.url)));
  const {version} = rendererRequire('katex/package.json');
  const stylesheets = (config.stylesheets ?? []).filter((entry) =>
    typeof entry === 'object' && entry.href.includes('/katex@'));
  assert.equal(stylesheets.length, 1, 'Configure exactly one pinned KaTeX stylesheet');
  const [stylesheet] = stylesheets;
  assert.equal(stylesheet.href, `https://cdn.jsdelivr.net/npm/katex@${version}/dist/katex.min.css`);
  assert.equal(stylesheet.integrity, `sha384-${createHash('sha384')
    .update(readFileSync(rendererRequire.resolve('katex/dist/katex.min.css'))).digest('base64')}`);
  assert.equal(stylesheet.type, 'text/css');
  assert.equal(stylesheet.crossorigin, 'anonymous');
  assert.equal(require('katex/package.json').version, version, 'Lint and rendering must use the same KaTeX version');
});
