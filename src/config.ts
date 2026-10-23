import type {Options as DocsOptions} from '@docusaurus/plugin-content-docs'
import type {Config, LoadContext, PluginConfig} from '@docusaurus/types'
import {createRequire} from 'node:module'
import {themes as prismThemes} from 'prism-react-renderer'
import {cardPathOf} from './cards.ts'
import {lightOf} from './colours.ts'
import {directiveAdmonitionTitles} from './markdown.ts'
import hubPlugin from './plugin.ts'
import {sidebarOf} from './sidebar.ts'
import {JAVADOC_DIR, builtSpaces, isLocalSource, pathOf, refOf, spaceDirOf, validate} from './spaces.ts'
import type {Site, Space} from './types.ts'

const require = createRequire(import.meta.url)

/**
 * The whole Docusaurus configuration of a hub: one docs instance per space with its own route,
 * sidebar and search context, tied together by a navbar dropdown per group and a landing page.
 */
export function createHubConfig(site: Site, spaces: Space[]): Config {
  validate(site, spaces)
  const built = builtSpaces(spaces)
  return {
    title: site.title,
    tagline: site.tagline,
    url: site.url,
    baseUrl: site.baseUrl ?? '/',
    favicon: site.favicon,
    staticDirectories: ['static', JAVADOC_DIR],
    trailingSlash: false,
    onBrokenLinks: 'throw',
    onBrokenAnchors: 'throw',
    future: {v4: true, faster: true},
    markdown: {
      format: 'detect',
      preprocessor: directiveAdmonitionTitles,
      hooks: {onBrokenMarkdownLinks: 'throw'},
    },
    i18n: {defaultLocale: 'en', locales: ['en']},
    presets: [[require.resolve('@docusaurus/preset-classic'), {
      docs: false,
      blog: false,
      pages: false,
      ...(site.customCss === undefined ? {} : {theme: {customCss: site.customCss}}),
    }]],
    themes: built.length === 0 ? [] : [searchTheme(built)],
    plugins: [
      (context: LoadContext) => hubPlugin(context, site, spaces),
      ...built.map(docsInstance),
    ],
    themeConfig: {
      colorMode: {respectPrefersColorScheme: true},
      image: cardPathOf(site.baseUrl ?? '/'),
      metadata: [{name: 'theme-color', content: lightOf(site.primary)}],
      navbar: {
        title: site.title,
        logo: site.logo,
        items: [
          ...site.groups
            .map(group => ({group, members: spaces.filter(space => space.group === group.id)}))
            .filter(({members}) => members.length > 0)
            .map(({group, members}) => ({
              type: 'dropdown',
              position: 'left',
              label: group.label,
              items: members.map(space =>
                space.href === undefined ? {label: space.title, to: `/${space.id}`} : {label: space.title, href: space.href}),
            })),
          ...(site.navbarLinks ?? []).map(link => ({...link, position: 'right'})),
        ],
      },
      footer: {style: 'dark', links: site.footer ?? [], copyright: site.copyright},
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['java', 'kotlin', 'groovy', 'bash', 'toml', 'properties', 'sql'],
      },
    },
  }
}

/**
 * Local search with one index per space. On a space's pages it searches that space; elsewhere it
 * searches all of them. The search bar needs at least one docs instance, so a hub without built
 * spaces has none.
 */
function searchTheme(built: Space[]): PluginConfig {
  return [require.resolve('@easyops-cn/docusaurus-search-local'), {
    hashed: true,
    indexBlog: false,
    indexPages: false,
    docsRouteBasePath: built.map(space => space.id),
    docsDir: built.map(spaceDirOf),
    docsPluginIdForPreferredVersion: built[0]!.id,
    searchContextByPaths: built.map(space => ({label: space.title, path: space.id})),
    useAllContextsWithNoSearchContext: true,
    highlightSearchTermsOnTargetPage: true,
  }]
}

function docsInstance(space: Space): PluginConfig {
  const options: DocsOptions = {
    id: space.id,
    path: spaceDirOf(space),
    routeBasePath: space.id,
    editUrl: ({docPath}) => editUrlOf(space, docPath),
    sidebarItemsGenerator: sidebarOf(space),
  }
  return [require.resolve('@docusaurus/plugin-content-docs'), options]
}

/**
 * The GitHub page that edits a doc in the repository it came from, or nothing for pages that live
 * in the hub itself.
 */
function editUrlOf(space: Space, docPath: string): string | undefined {
  const sources = space.sources!
  const [first, ...rest] = docPath.split('/')
  const mounted = sources.find(source => source.mount !== undefined && source.mount === first)
  const source = mounted ?? sources.find(candidate => candidate.mount === undefined)!
  if (isLocalSource(source)) return undefined
  const path = mounted ? rest.join('/') : docPath
  return `https://github.com/${source.repo}/edit/${refOf(source)}/${pathOf(source)}/${path}`
}
