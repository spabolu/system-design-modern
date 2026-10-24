import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Modern System Design',
  tagline: 'From fundamentals to advanced, architected on Azure.',
  favicon: 'img/favicon.ico',
  url: 'https://spabolu.github.io',
  baseUrl: '/system-design-modern/',
  organizationName: 'spabolu',
  projectName: 'system-design-modern',
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
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          showLastUpdateTime: true,
          editUrl: 'https://github.com/spabolu/system-design-modern/tree/main/',
        },
        blog: {
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
            {
              label: 'Azure Architecture Center',
              href: 'https://learn.microsoft.com/azure/architecture/',
            },
            {
              label: 'Azure Well-Architected Framework',
              href: 'https://learn.microsoft.com/azure/well-architected/',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Saketh Pabolu`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
