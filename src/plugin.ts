import type {LoadContext, Plugin} from '@docusaurus/types'
import {fileURLToPath} from 'node:url'
import {type Card, writeCards} from './cards.ts'
import {colourCss, lightOf} from './colours.ts'
import {writeRedirects} from './redirects.ts'
import {javadocRouteOf} from './spaces.ts'
import type {Group, Link, Site, Space} from './types.ts'

/**
 * What the theme components read through `usePluginData('docs-hub')`.
 */
export interface HubData {
  groups: Group[]
  spaces: SpaceEntry[]
}

/**
 * A space as the theme shows it: on the landing page, in the navbar and in its sidebar header.
 */
export interface SpaceEntry {
  id: string
  title: string
  description: string
  group: string
  to?: string
  href?: string
  colour: string
  javadoc: Link[]
}

const THEME_DIR = fileURLToPath(new URL('./theme', import.meta.url))

/**
 * Adds the landing page, the space header in every sidebar, the hub stylesheet and the colours of
 * the site and its spaces. After the build it writes the nginx rules for redirects and Javadoc and
 * renders a preview card for the landing page and every docs page.
 */
export default function hubPlugin(context: LoadContext, site: Site, spaces: Space[]): Plugin {
  const data: HubData = {
    groups: site.groups,
    spaces: spaces.map(space => ({
      id: space.id,
      title: space.title,
      description: space.description,
      group: space.group,
      ...(space.href === undefined ? {to: `/${space.id}`} : {href: space.href}),
      colour: lightOf(space.accent ?? site.primary),
      javadoc: (space.javadoc ?? []).map(artifact => ({
        label: artifact.label ?? 'Javadoc',
        href: `${context.baseUrl}${javadocRouteOf(space, artifact).slice(1)}`,
      })),
    })),
  }
  const cards: Card[] = [{permalink: context.baseUrl, title: site.title, description: site.tagline}]
  const javadocRoutes = spaces.flatMap(space => (space.javadoc ?? []).map(artifact => javadocRouteOf(space, artifact)))
  return {
    name: 'docs-hub',
    getThemePath: () => THEME_DIR,
    getClientModules: () => [`${THEME_DIR}/hub.css`],
    async contentLoaded({actions}) {
      actions.setGlobalData(data)
      actions.addRoute({path: context.baseUrl, component: '@theme/HubLanding', exact: true})
    },
    async allContentLoaded({allContent}) {
      cards.push(...docCards(allContent, site, spaces))
    },
    injectHtmlTags: () => ({headTags: [{tagName: 'style', innerHTML: colourCss(site, spaces)}]}),
    async postBuild({routesPaths, outDir}) {
      writeRedirects(site.redirects ?? {}, javadocRoutes, routesPaths, outDir)
      await writeCards(site, context.siteDir, outDir, cards)
    },
  }
}

interface LoadedDocs {
  loadedVersions: {docs: {title: string, description: string, permalink: string}[]}[]
}

/**
 * A card for every page of every built space, from the content the docs instances loaded.
 */
function docCards(allContent: unknown, site: Site, spaces: Space[]): Card[] {
  const docs = (allContent as Record<string, Record<string, LoadedDocs> | undefined>)['docusaurus-plugin-content-docs'] ?? {}
  return spaces.flatMap(space => (docs[space.id]?.loadedVersions ?? []).flatMap(version => version.docs.map(doc => ({
    permalink: doc.permalink,
    title: doc.title,
    description: doc.description,
    space: {title: space.title, accent: space.accent ?? site.primary},
  }))))
}
