import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {
  checkLink, checkLinks, extractExternalLinks, formatResult, indexExternalLinks,
} from './check-links.mjs';

test('extracts Markdown, autolinks, HTML, YAML, and bare URLs without trailing punctuation', () => {
  assert.deepEqual(extractExternalLinks(`
    [a](https://example.com/a)
    <https://example.com/b>
    <a href="https://example.com/c?a=1&amp;b=2">C</a>
    url: https://example.com/d
    See https://example.com/e.
    [parentheses](https://example.com/a_(b))
  `), [
    'https://example.com/a', 'https://example.com/b',
    'https://example.com/c?a=1&b=2', 'https://example.com/d',
    'https://example.com/e', 'https://example.com/a_(b)',
  ]);
});

test('deduplicates links and retains every referring file', () => {
  const links = indexExternalLinks(new Map([
    ['docs/a.md', '[a](https://example.com/a#first) https://example.com/a'],
    ['blog/b.md', '<https://example.com/a#second>'],
  ]));
  assert.equal(links.size, 1);
  assert.deepEqual([...links.get('https://example.com/a')], ['docs/a.md', 'blog/b.md']);
});

test('GET requests follow redirects and classify HTTP and connection failures', async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({method: request.method, agent: request.headers['user-agent']});
    if (request.url === '/redirect') {
      response.writeHead(302, {Location: '/200'}).end();
    } else {
      response.writeHead(Number(request.url.slice(1))).end('Result');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await checkLink(`${base}/redirect`)).kind, 'ok');
    for (const status of [401, 403, 429]) {
      const result = await checkLink(`${base}/${status}`);
      assert.equal(result.kind, 'unverified');
      assert.equal(result.detail, `HTTP ${status}`);
    }
    for (const status of [404, 410, 500]) {
      const result = await checkLink(`${base}/${status}`);
      assert.equal(result.kind, 'failure');
      assert.equal(result.detail, `HTTP ${status}`);
    }
    assert.ok(requests.every(({method, agent}) => method === 'GET' && /Mozilla\/5.0/.test(agent)));
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  const refused = await checkLink(`${base}/closed`);
  assert.equal(refused.kind, 'failure');
  assert.match(refused.detail, /^ECONN(?:REFUSED|RESET)$/);
});

test('DNS errors and timeouts are failures', async () => {
  const dnsFailure = await checkLink('https://example.invalid', {
    fetchImpl: async () => {
      throw new TypeError('fetch failed', {cause: {code: 'ENOTFOUND'}});
    },
  });
  assert.equal(dnsFailure.kind, 'failure');
  assert.equal(dnsFailure.detail, 'ENOTFOUND');

  const server = createServer(() => {});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const result = await checkLink(`http://127.0.0.1:${server.address().port}`, {timeout: 20});
    assert.equal(result.kind, 'failure');
    assert.equal(result.detail, 'TimeoutError');
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});

test('the worker limit bounds concurrent requests and reports source files', async () => {
  let active = 0;
  let maximum = 0;
  const server = createServer((request, response) => {
    active += 1;
    maximum = Math.max(maximum, active);
    setTimeout(() => {
      active -= 1;
      response.writeHead(404).end();
    }, 15);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const results = await checkLinks(new Map([
      ['docs/a.md', Array.from({length: 9}, (_, index) => `${base}/${index}`).join('\n')],
      ['README.md', `${base}/0`],
    ]), {concurrency: 3});
    assert.equal(results.length, 9);
    assert.equal(maximum, 3);
    assert.ok(results.every(({kind}) => kind === 'failure'));
    const output = formatResult(results[0]);
    assert.match(output, /error: HTTP 404:/);
    assert.match(output, /referenced by README.md, docs\/a.md/);
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
