import {writeFileSync} from 'node:fs'
import {join} from 'node:path'

export const REDIRECTS_FILE = 'nginx-redirects.conf'

/**
 * Checks every redirect target against the built routes and writes them as exact nginx locations,
 * each old path with and without a trailing slash, into the build output.
 */
export function writeRedirects(redirects: Record<string, string>, routesPaths: string[], outDir: string): void {
  const routes = new Set(routesPaths)
  const problems = Object.entries(redirects)
    .filter(([from, to]) => !from.startsWith('/') || (!/^https?:\/\//.test(to) && !routes.has(to)))
    .map(([from, to]) => `${from} -> ${to}`)
  if (problems.length > 0) {
    throw new Error(`Redirects need an old path starting with "/" and an existing route or URL:\n  ${problems.join('\n  ')}`)
  }
  const locations = Object.entries(redirects).flatMap(([from, to]) => {
    const bare = from.replace(/\/+$/, '') || '/'
    const paths = bare === '/' ? ['/'] : [bare, `${bare}/`]
    return paths.map(path => `location = ${path} { return 301 ${to}; }`)
  })
  writeFileSync(join(outDir, REDIRECTS_FILE), `${locations.join('\n')}\n`)
}
