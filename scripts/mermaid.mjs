import {JSDOM} from 'jsdom';

let parser;

export async function parseMermaid(source) {
  parser ??= (async () => {
    // DOMPurify binds to window when Mermaid imports it, even for parse-only use.
    globalThis.window = new JSDOM('').window;
    const {default: mermaid} = await import('mermaid');
    mermaid.initialize({startOnLoad: false});
    return mermaid;
  })();
  const mermaid = await parser;
  try {
    await mermaid.parse(source);
  } catch (cause) {
    return cause.message.split(/\r?\n/)[0];
  }
}
