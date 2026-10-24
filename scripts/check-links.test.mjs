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
      const result = await checkLink(`${base}/${status}`, {maxRetries: 0});
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

  // A port fetch never connected to, so no pooled keep-alive socket turns the refusal into a reset.
  const unused = createServer();
  unused.listen(0, '127.0.0.1');
  await once(unused, 'listening');
  const closedBase = `http://127.0.0.1:${unused.address().port}`;
  await new Promise((done) => unused.close(done));
  const refused = await checkLink(`${closedBase}/closed`);
  assert.equal(refused.kind, 'failure');
  assert.equal(refused.detail, 'ECONNREFUSED');
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
    ]), {concurrency: 3, perHostConcurrency: 4});
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

for (const [retryAfter, expectedWait] of [
  ['2', 2000],
  ['Sat, 24 Oct 2026 12:00:03 GMT', 3000],
  ['120', 30_000],
  ['Sun, 25 Oct 2026 12:00:00 GMT', 30_000],
  ['Sat, 24 Oct 2026 11:59:00 GMT', 0],
]) {
  test(`429 retries honor Retry-After ${retryAfter} with a capped wait`, async () => {
    let attempts = 0;
    const waits = [];
    const result = await checkLink('https://example.com/page', {
      fetchImpl: async () => new Response(null, {
        status: ++attempts === 1 ? 429 : 200,
        headers: {'Retry-After': retryAfter},
      }),
      sleepImpl: async (milliseconds) => { waits.push(milliseconds); },
      now: () => Date.parse('Sat, 24 Oct 2026 12:00:00 GMT'),
    });
    assert.deepEqual(result, {url: 'https://example.com/page', kind: 'ok', detail: 'HTTP 200'});
    assert.equal(attempts, 2);
    assert.deepEqual(waits, [expectedWait]);
  });
}

for (const retryAfter of [undefined, 'not a date']) {
  test(`429 without a usable Retry-After ${retryAfter} backs off with jitter and stops after three retries`,
    async () => {
      let attempts = 0;
      let cancelled = 0;
      const waits = [];
      const result = await checkLink('https://example.com/page', {
        fetchImpl: async () => {
          attempts += 1;
          return new Response(new ReadableStream({cancel() { cancelled += 1; }}), {
            status: 429,
            headers: retryAfter ? {'Retry-After': retryAfter} : {},
          });
        },
        sleepImpl: async (milliseconds) => { waits.push(milliseconds); },
        random: () => 0.25,
      });
      assert.equal(attempts, 4);
      assert.equal(cancelled, 4);
      assert.deepEqual(waits, [1250, 2250, 4250]);
      assert.deepEqual(result, {
        url: 'https://example.com/page', kind: 'unverified', detail: 'HTTP 429',
      });
    });
}

for (const status of [401, 403, 404, 500]) {
  test(`HTTP ${status} is not retried`, async () => {
    let attempts = 0;
    const result = await checkLink('https://example.com/page', {
      fetchImpl: async () => {
        attempts += 1;
        return new Response(null, {status});
      },
      sleepImpl: async () => { assert.fail('Only 429 responses should retry.'); },
    });
    assert.equal(attempts, 1);
    assert.equal(result.kind, [401, 403].includes(status) ? 'unverified' : 'failure');
    assert.equal(result.detail, `HTTP ${status}`);
  });
}

test('host limits do not block unrelated hosts and preserve result order', async () => {
  const urls = ['one.example', 'two.example'].flatMap((host) =>
    Array.from({length: 5}, (_, index) => `https://${host}/${index}`));
  let active = 0;
  let maximum = 0;
  const activeByHost = new Map();
  const maximumByHost = new Map();
  const results = await checkLinks(new Map([['docs/a.md', urls.join('\n')]]), {
    concurrency: 3,
    fetchImpl: async (url) => {
      const {host} = new URL(url);
      active += 1;
      maximum = Math.max(maximum, active);
      activeByHost.set(host, (activeByHost.get(host) ?? 0) + 1);
      maximumByHost.set(host, Math.max(maximumByHost.get(host) ?? 0, activeByHost.get(host)));
      await new Promise((done) => setTimeout(done, 5));
      activeByHost.set(host, activeByHost.get(host) - 1);
      active -= 1;
      return new Response(null, {status: 200});
    },
  });
  assert.equal(maximum, 3);
  assert.deepEqual([...maximumByHost.values()], [2, 2]);
  assert.deepEqual(results.map(({url}) => url), urls);
  assert.ok(results.every(({kind}) => kind === 'ok'));
});

test('host slots remain reserved during retries', async () => {
  const attempts = new Map();
  let waiting = 0;
  let maximumWaiting = 0;
  const results = await checkLinks(new Map([['docs/a.md',
    Array.from({length: 5}, (_, index) => `https://example.com/${index}`).join('\n')]]), {
    fetchImpl: async (url) => {
      const count = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, count);
      return new Response(null, {status: count === 1 ? 429 : 200});
    },
    sleepImpl: async () => {
      waiting += 1;
      maximumWaiting = Math.max(maximumWaiting, waiting);
      await new Promise((done) => setTimeout(done, 5));
      waiting -= 1;
    },
  });
  assert.equal(maximumWaiting, 2);
  assert.deepEqual([...attempts.values()], [2, 2, 2, 2, 2]);
  assert.ok(results.every(({kind}) => kind === 'ok'));
});

test('empty link sets finish and invalid concurrency is rejected', async () => {
  assert.deepEqual(await checkLinks(new Map()), []);
  for (const option of ['concurrency', 'perHostConcurrency']) {
    for (const value of [0, -1, 1.5]) {
      await assert.rejects(checkLinks(new Map(), {[option]: value}), /must be a positive integer/);
    }
  }
});
