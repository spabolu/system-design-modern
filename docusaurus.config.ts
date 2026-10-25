import {themes as prismThemes} from 'prism-react-renderer';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {version} from './package.json';

const config: Config = {
  title: 'Modern System Design',
  tagline: 'From fundamentals to advanced, architected on Azure.',
  favicon: 'img/favicon.ico',
  url: 'https://red-meadow-0c7d14a0f.4.azurestaticapps.net',
  baseUrl: '/',
  trailingSlash: false,
  future: {v4: true},
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    format: 'detect',
    mermaid: true,
    hooks: {onBrokenMarkdownLinks: 'throw'},
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexDocs: true,
        indexBlog: true,
        blogRouteBasePath: 'notes',
      },
    ],
  ],
  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css',
      type: 'text/css',
      integrity: 'sha384-nH0MfJ44wi1dd7w6jinlyBgljjS8EJAh2JBoRad8a3VDw2K69vfaaqm4WnR+gXtA',
      crossorigin: 'anonymous',
    },
  ],
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
          numberPrefixParser: false,
          showLastUpdateTime: true,
          editUrl: 'https://github.com/spabolu/system-design-modern/tree/main/',
        },
        blog: {
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
          blogTitle: 'Notes',
          blogDescription: 'Dated notes on system design developments and their place in the curriculum.',
          routeBasePath: 'notes',
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/spabolu/system-design-modern/tree/main/',
          onInlineTags: 'throw',
          onInlineAuthors: 'throw',
          onUntruncatedBlogPosts: 'throw',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {respectPrefersColorScheme: true},
    navbar: {
      title: 'Modern System Design',
      logo: {
        alt: 'Stacked system components',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'curriculum',
          position: 'left',
          label: 'Learn',
        },
        {to: '/notes', label: 'Notes', position: 'left'},
        {
          href: 'https://github.com/spabolu/system-design-modern',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Explore',
          items: [
            {label: 'Learn', to: '/docs/intro'},
            {label: 'Notes', to: '/notes'},
          ],
        },
        {
          title: 'References',
          items: [
            {
              label: 'Azure Architecture Center',
              href: 'https://learn.microsoft.com/azure/architecture/',
            },
            {
              label: 'Azure Well-Architected Framework',
              href: 'https://learn.microsoft.com/azure/well-architected/',
            },
            {
              label: 'Hello Interview',
              href: 'https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction',
            },
            {
              label: 'The Coding Gopher on Substack',
              href: 'https://thecodinggopher.substack.com/archive',
            },
            {
              label: 'The Coding Gopher on YouTube',
              href: 'https://www.youtube.com/@TheCodingGopher',
            },
          ],
        },
      ],
      copyright: `v${version}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
