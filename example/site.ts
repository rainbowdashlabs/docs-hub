import type {Site} from 'docs-hub'

export default {
  title: 'Example Hub',
  tagline: 'Placeholder hub that builds the docs-hub package without any real project in it.',
  url: 'https://example.invalid',
  favicon: 'img/favicon.svg',
  primary: {light: '#2e7d32', dark: '#66bb6a'},
  groups: [
    {id: 'projects', label: 'Projects'},
    {id: 'tools', label: 'Tools'},
  ],
  navbarLinks: [{label: 'Source', href: 'https://example.invalid/source'}],
  footer: [{title: 'Help', items: [{label: 'Issues', href: 'https://example.invalid/issues'}]}],
  copyright: 'Example',
  redirects: {
    '/old/core/usage': '/core/usage/commands',
    '/old/elsewhere': 'https://example.invalid/elsewhere',
  },
} satisfies Site
