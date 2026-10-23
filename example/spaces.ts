import type {Space} from 'docs-hub'

export default [
  {
    id: 'core',
    title: 'Core',
    description: 'A space built from two sources, the second mounted as a sub-section.',
    group: 'projects',
    accent: {light: '#1565c0', dark: '#64b5f6'},
    sources: [
      {dir: 'fixture/core'},
      {dir: 'fixture/addon', mount: 'addon', label: 'Add-on'},
    ],
  },
  {
    id: 'elsewhere',
    title: 'Elsewhere',
    description: 'A space hosted on another site.',
    group: 'projects',
    href: 'https://example.invalid/elsewhere',
  },
  {
    id: 'tool',
    title: 'Tool',
    description: 'A space in a second group, using the site colour.',
    group: 'tools',
    sources: [{dir: 'fixture/tool'}],
  },
] satisfies Space[]
