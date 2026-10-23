import {unzipSync} from 'fflate'
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {dirname, join, relative, sep} from 'node:path'
import {darkOf, lightOf, shade} from './colours.ts'
import {JAVADOC_DIR, builtSpaces, javadocRouteOf} from './spaces.ts'
import type {JavadocArtifact, Site, Space} from './types.ts'

const CENTRAL = 'https://repo1.maven.org/maven2'
const CACHE = '.cache/javadoc'
const STYLESHEET = 'hub-javadoc.css'
const PRE_RELEASE = /-(alpha|beta|rc|dev|snapshot|pre|m)[.-]?\d*$/i
const NAVBAR = '<ul id="navbar-top-firstrow" class="nav-list" title="Navigation">'
const THEME_SCRIPT = '<script>try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")'
  + 't=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";'
  + 'document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>'

/**
 * Downloads the released `-javadoc.jar` of every space's APIs and unpacks it into `.javadoc/`, which
 * the site serves as static files at each Javadoc's route.
 *
 * Every page is restyled with the hub's look and the space's accent, follows the colour mode chosen on
 * the docs pages, and gets a link back to its space in the Javadoc navigation bar.
 */
export async function syncJavadoc(siteDir: string, site: Site, spaces: Space[]): Promise<void> {
  rmSync(join(siteDir, JAVADOC_DIR), {recursive: true, force: true})
  mkdirSync(join(siteDir, JAVADOC_DIR), {recursive: true})
  const repositories = site.mavenRepositories ?? [CENTRAL]
  for (const space of builtSpaces(spaces)) {
    for (const artifact of space.javadoc ?? []) {
      const {repository, version} = await locate(artifact, repositories)
      const jar = await download(siteDir, repository, artifact, version)
      const route = javadocRouteOf(space, artifact)
      const target = join(siteDir, JAVADOC_DIR, ...route.split('/').filter(Boolean))
      unpack(jar, target, `${site.baseUrl ?? '/'}${space.id}`, space.title)
      writeFileSync(join(target, STYLESHEET), javadocCss(site, space))
      console.log(`[docs-hub] ${route} <- ${artifact.artifact}:${version}`)
    }
  }
}

async function locate(artifact: JavadocArtifact, repositories: string[]): Promise<{repository: string, version: string}> {
  for (const repository of repositories) {
    if (artifact.version !== undefined) {
      if ((await fetch(jarUrl(repository, artifact, artifact.version), {method: 'HEAD'})).ok) {
        return {repository, version: artifact.version}
      }
      continue
    }
    const response = await fetch(`${repository}/${artifactPath(artifact)}/maven-metadata.xml`)
    if (!response.ok) continue
    const versions = [...(await response.text()).matchAll(/<version>([^<]+)<\/version>/g)].map(match => match[1]!)
    const release = versions.filter(version => !PRE_RELEASE.test(version)).at(-1)
    if (release !== undefined) return {repository, version: release}
  }
  throw new Error(`No released Javadoc of ${artifact.artifact}${artifact.version ? `:${artifact.version}` : ''} in ${repositories.join(', ')}.`)
}

async function download(siteDir: string, repository: string, artifact: JavadocArtifact, version: string): Promise<Uint8Array> {
  const cached = join(siteDir, CACHE, artifactPath(artifact), `${version}.jar`)
  if (existsSync(cached) && !version.endsWith('-SNAPSHOT')) return readFileSync(cached)
  const response = await fetch(jarUrl(repository, artifact, version))
  if (!response.ok) throw new Error(`Could not download the Javadoc of ${artifact.artifact}:${version}: HTTP ${response.status}.`)
  const jar = new Uint8Array(await response.arrayBuffer())
  mkdirSync(dirname(cached), {recursive: true})
  writeFileSync(cached, jar)
  return jar
}

function unpack(jar: Uint8Array, target: string, spaceRoute: string, spaceTitle: string): void {
  const back = `<li><a href="${spaceRoute}">&larr; ${escapeHtml(spaceTitle)}</a></li>`
  for (const [name, content] of Object.entries(unzipSync(jar))) {
    if (name.endsWith('/') || name.startsWith('META-INF/')) continue
    const file = join(target, ...name.split('/'))
    mkdirSync(dirname(file), {recursive: true})
    if (!name.endsWith('.html')) {
      writeFileSync(file, content)
      continue
    }
    const root = relative(dirname(file), target).split(sep).filter(Boolean).map(() => '..').join('/')
    const stylesheet = `${root === '' ? '' : `${root}/`}${STYLESHEET}`
    const html = new TextDecoder().decode(content)
      .replace('</head>', `<link rel="stylesheet" href="${stylesheet}">${THEME_SCRIPT}</head>`)
      .replace(NAVBAR, `${NAVBAR}${back}`)
    writeFileSync(file, html)
  }
}

/**
 * Maps Javadoc's own style variables onto the hub's look: the space's accent for links, the navigation
 * bar and selections, the hub's fonts, and a dark palette matching the docs pages.
 */
function javadocCss(site: Site, space: Space): string {
  const accent = space.accent ?? site.primary
  const light = lightOf(accent)
  const dark = darkOf(accent)
  return `:root {
  --body-font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Noto Sans", sans-serif;
  --block-font-family: var(--body-font-family);
  --code-font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --link-color: ${light};
  --link-color-active: ${shade(light, -0.15)};
  --table-header-color: color-mix(in srgb, ${light} 8%, #ffffff);
  --navbar-background-color: ${shade(light, -0.15)};
  --navbar-text-color: #ffffff;
  --subnav-background-color: color-mix(in srgb, ${light} 10%, #ffffff);
  --selected-background-color: ${light};
  --selected-text-color: #ffffff;
  --selected-link-color: #ffffff;
  --search-tag-highlight-color: color-mix(in srgb, ${light} 25%, #ffffff);
  --mark-background-color: color-mix(in srgb, ${light} 25%, #ffffff);
  --toc-highlight-color: color-mix(in srgb, ${light} 15%, #ffffff);
}
html[data-theme='dark'] {
  color-scheme: dark;
  --body-background-color: #1b1b1d;
  --section-background-color: #242526;
  --detail-background-color: #1b1b1d;
  --detail-block-color: #242526;
  --member-heading-background-color: #242526;
  --body-text-color: #e3e3e3;
  --block-text-color: #e3e3e3;
  --title-color: #e3e3e3;
  --border-color: #444950;
  --table-border-color: #444950;
  --button-border-color: #444950;
  --even-row-color: #1b1b1d;
  --odd-row-color: #242526;
  --code-background-color: #2b2b2b;
  --pre-background-color: #2b2b2b;
  --pre-text-color: #e3e3e3;
  --snippet-background-color: #2b2b2b;
  --snippet-text-color: #e3e3e3;
  --source-linenumber-color: #8d949e;
  --search-input-background-color: #242526;
  --search-input-text-color: #e3e3e3;
  --search-input-placeholder-color: #8d949e;
  --copy-button-background-color: #242526;
  --toc-background-color: #1b1b1d;
  --toc-hover-color: #242526;
  --invalid-tag-background-color: #5a2a2a;
  --invalid-tag-text-color: #f2dede;
  --link-color: ${dark};
  --link-color-active: ${shade(dark, 0.15)};
  --table-header-color: #2f3033;
  --copy-button-background-color-active: #303846;
  --snippet-highlight-color: #4d4325;
  --navbar-background-color: color-mix(in srgb, ${dark} 30%, #1b1b1d);
  --subnav-background-color: #242526;
  --subnav-link-color: #e3e3e3;
  --selected-background-color: ${dark};
  --selected-text-color: #1b1b1d;
  --selected-link-color: #1b1b1d;
  --search-tag-highlight-color: color-mix(in srgb, ${dark} 35%, #1b1b1d);
  --mark-background-color: color-mix(in srgb, ${dark} 35%, #1b1b1d);
  --toc-highlight-color: color-mix(in srgb, ${dark} 25%, #1b1b1d);
}
html[data-theme='dark'] .ui-widget-content,
html[data-theme='dark'] .ui-autocomplete {
  background: #242526;
  color: #e3e3e3;
  border-color: #444950;
}
html[data-theme='dark'] img[src$='.svg'] {
  filter: invert(1);
}
`
}

function artifactPath(artifact: JavadocArtifact): string {
  const [group, name] = artifact.artifact.split(':')
  return `${group!.replaceAll('.', '/')}/${name}`
}

function jarUrl(repository: string, artifact: JavadocArtifact, version: string): string {
  const name = artifact.artifact.split(':')[1]
  return `${repository}/${artifactPath(artifact)}/${version}/${name}-${version}-javadoc.jar`
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
