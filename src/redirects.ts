import {writeFileSync} from 'node:fs'
import {join} from 'node:path'

export const REDIRECTS_FILE = 'nginx-redirects.conf'

/**
 * Writes the nginx rules the hub needs besides plain files into the build output: the site's
 * redirects, checked against the built routes, and one location per Javadoc.
 *
 * Every redirect answers with and without a trailing slash. Javadoc links relatively, so a Javadoc
 * keeps its trailing slash and its bare address redirects to it, unlike the docs pages.
 */
export function writeRedirects(redirects: Record<string, string>, javadocRoutes: string[], routesPaths: string[], outDir: string): void {
  const routes = new Set(routesPaths)
  const problems = Object.entries(redirects)
    .filter(([from, to]) => !from.startsWith('/') || (!/^https?:\/\//.test(to) && !routes.has(to)))
    .map(([from, to]) => `${from} -> ${to}`)
  if (problems.length > 0) {
    throw new Error(`Redirects need an old path starting with "/" and an existing route or URL:\n  ${problems.join('\n  ')}`)
  }
  const redirectLocations = Object.entries(redirects).flatMap(([from, to]) => {
    const bare = from.replace(/\/+$/, '') || '/'
    const paths = bare === '/' ? ['/'] : [bare, `${bare}/`]
    return paths.map(path => `location = ${path} { return 301 ${to}; }`)
  })
  const javadocLocations = javadocRoutes.flatMap(route => [
    `location = ${route.replace(/\/$/, '')} { return 301 ${route}; }`,
    `location ^~ ${route} { try_files $uri $uri/ =404; }`,
  ])
  writeFileSync(join(outDir, REDIRECTS_FILE), `${[...redirectLocations, ...javadocLocations].join('\n')}\n`)
}
