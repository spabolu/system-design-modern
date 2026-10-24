import {resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {readTextFiles} from './files.mjs';

export function extractExternalLinks(source) {
  const links = new Set();
  for (const match of source.matchAll(/https?:\/\/[^\s<>"'`\\]+/g)) {
    let candidate = match[0].replace(/[.,;:!?]+$/, '');
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (candidate.endsWith(close) &&
          candidate.split(close).length > candidate.split(open).length) {
        candidate = candidate.slice(0, -1);
      }
    }
    candidate = candidate.replace(/[.,;:!?]+$/, '').replaceAll('&amp;', '&');
    try {
      const url = new URL(candidate);
      url.hash = '';
      links.add(url.href);
    } catch {
      // Text that resembles a URL can be incomplete in a code example.
    }
  }
  return [...links];
}

export function indexExternalLinks(files) {
  const links = new Map();
  for (const [path, source] of files) {
    for (const url of extractExternalLinks(source)) {
      if (!links.has(url)) links.set(url, new Set());
      links.get(url).add(path);
    }
  }
  return links;
}

function retryDelay(retryAfter, attempt, now, random) {
  let wait = NaN;
  if (retryAfter?.trim()) {
    const seconds = Number(retryAfter);
    wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now();
  }
  if (!Number.isFinite(wait)) wait = 1000 * 2 ** attempt + random() * 1000;
  return Math.min(30_000, Math.max(0, wait));
}

export async function checkLink(url, {
  timeout = 15_000, fetchImpl = fetch, maxRetries = 3,
  sleepImpl = sleep, now = Date.now, random = Math.random,
} = {}) {
  try {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ModernSystemDesignLinkChecker/1.0)',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(timeout),
      });
      await response.body?.cancel();
      if (response.status === 429 && attempt < maxRetries) {
        await sleepImpl(retryDelay(response.headers.get('retry-after'), attempt, now, random));
        continue;
      }
      const kind = response.ok ? 'ok' :
        [401, 403, 429].includes(response.status) ? 'unverified' : 'failure';
      return {url, kind, detail: `HTTP ${response.status}`};
    }
  } catch (cause) {
    return {
      url,
      kind: 'failure',
      detail: cause.cause?.code ?? (typeof cause.code === 'string' ? cause.code : cause.name),
    };
  }
}

export async function checkLinks(files, {concurrency = 8, perHostConcurrency = 2, ...options} = {}) {
  for (const [name, value] of Object.entries({concurrency, perHostConcurrency})) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  }
  const pending = [...indexExternalLinks(files)].map(([url, paths], index) => ({
    url, paths, index, host: new URL(url).host,
  }));
  const results = new Array(pending.length);
  const activeByHost = new Map();
  const running = new Set();
  while (pending.length || running.size) {
    while (running.size < concurrency) {
      const next = pending.findIndex(({host}) => (activeByHost.get(host) ?? 0) < perHostConcurrency);
      if (next < 0) break;
      const [{url, paths, index, host}] = pending.splice(next, 1);
      activeByHost.set(host, (activeByHost.get(host) ?? 0) + 1);
      const request = checkLink(url, options).then((result) => {
        results[index] = {...result, paths: [...paths].sort()};
      }).finally(() => {
        activeByHost.set(host, activeByHost.get(host) - 1);
        running.delete(request);
      });
      running.add(request);
    }
    await Promise.race(running);
  }
  return results;
}

export function formatResult({url, kind, detail, paths}) {
  return `${kind === 'failure' ? 'error' : kind}: ${detail}: ${url}\n  referenced by ${paths.join(', ')}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const files = readTextFiles(process.cwd(), ['docs', 'blog', 'CONTRIBUTING.md', 'README.md']);
    const results = await checkLinks(files);
    for (const result of results) {
      if (result.kind !== 'ok') console.log(formatResult(result));
    }
    const failures = results.filter(({kind}) => kind === 'failure').length;
    const unverified = results.filter(({kind}) => kind === 'unverified').length;
    console.log(`${results.length} links checked: ${failures} failures, ${unverified} unverified.`);
    process.exitCode = failures > 0 ? 1 : 0;
  } catch (cause) {
    console.error(`Link check failed: ${cause.message}`);
    process.exitCode = 1;
  }
}
