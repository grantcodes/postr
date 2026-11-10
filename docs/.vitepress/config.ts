import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Postr',
  description:
    'An IndieWeb backend for Node.js: Micropub server, media endpoint and typed post API',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Plugins', link: '/guide/plugins' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Posts API', link: '/guide/posts-api' },
          { text: 'Plugins', link: '/guide/plugins' },
          { text: 'Astro', link: '/guide/astro' },
          { text: 'Migrating from 1.x', link: '/guide/migrating' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/grantcodes/postr' }],
    editLink: {
      pattern: 'https://github.com/grantcodes/postr/edit/master/docs/:path',
    },
    search: { provider: 'local' },
  },
})
