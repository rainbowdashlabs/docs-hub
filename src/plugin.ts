import type {LoadContext, Plugin} from '@docusaurus/types'
import {fileURLToPath} from 'node:url'
import {colourCss} from './colours.ts'
import {writeRedirects} from './redirects.ts'
import type {Group, Site, Space} from './types.ts'

/**
 * What the theme components read through `usePluginData('docs-hub')`.
 */
export interface HubData {
  groups: Group[]
  spaces: {id: string, title: string, description: string, group: string, to?: string, href?: string}[]
}

const THEME_DIR = fileURLToPath(new URL('./theme', import.meta.url))

/**
 * Adds the landing page, the space header in every sidebar, the hub stylesheet and the colours of
 * the site and its spaces, and writes the site's redirects for nginx after the build.
 */
export default function hubPlugin(context: LoadContext, site: Site, spaces: Space[]): Plugin {
  const data: HubData = {
    groups: site.groups,
    spaces: spaces.map(({id, title, description, group, href}) =>
      href === undefined ? {id, title, description, group, to: `/${id}`} : {id, title, description, group, href}),
  }
  return {
    name: 'docs-hub',
    getThemePath: () => THEME_DIR,
    getTypeScriptThemePath: () => THEME_DIR,
    getClientModules: () => [`${THEME_DIR}/hub.css`],
    async contentLoaded({actions}) {
      actions.setGlobalData(data)
      actions.addRoute({path: context.baseUrl, component: '@theme/HubLanding', exact: true})
    },
    injectHtmlTags: () => ({headTags: [{tagName: 'style', innerHTML: colourCss(site, spaces)}]}),
    postBuild: ({routesPaths, outDir}) => writeRedirects(site.redirects ?? {}, routesPaths, outDir),
  }
}
