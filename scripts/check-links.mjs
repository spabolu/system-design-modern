import {resolve} from 'node:path';
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

export async function checkLink(url, {timeout = 15_000, fetchImpl = fetch} = {}) {
  try {
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
    const kind = response.ok ? 'ok' :
      [401, 403, 429].includes(response.status) ? 'unverified' : 'failure';
    return {url, kind, detail: `HTTP ${response.status}`};
  } catch (cause) {
    return {
      url,
      kind: 'failure',
      detail: cause.cause?.code ?? (typeof cause.code === 'string' ? cause.code : cause.name),
    };
  }
}

export async function checkLinks(files, {concurrency = 8, ...options} = {}) {
  const links = [...indexExternalLinks(files)];
  const results = new Array(links.length);
  let next = 0;
  async function worker() {
    while (next < links.length) {
      const index = next++;
      const [url, paths] = links[index];
      results[index] = {...await checkLink(url, options), paths: [...paths].sort()};
    }
  }
  await Promise.all(Array.from({length: Math.min(concurrency, links.length)}, worker));
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
