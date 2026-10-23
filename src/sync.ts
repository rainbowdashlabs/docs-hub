import {execFileSync} from 'node:child_process'
import {copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, watch} from 'node:fs'
import {basename, dirname, join, resolve} from 'node:path'
import {
  CACHE_DIR,
  SPACES_DIR,
  builtSpaces,
  isLocalSource,
  overrideVariableOf,
  pathOf,
  refOf,
  spaceDirOf,
} from './spaces.ts'
import type {RepositorySource, Source, Space} from './types.ts'

/**
 * Where one source's pages were read from and where they were copied to. `live` sources are folders
 * on this machine and are kept in sync while the dev server runs.
 */
export interface Placement {
  space: Space
  source: Source
  from: string
  to: string
  live: boolean
}

const INDEX_FILES = ['index.md', 'index.mdx', 'README.md', 'README.mdx']

/**
 * Gathers every source of every space into `.spaces/<space id>/`, replacing what was there.
 *
 * Repository sources are fetched with a shallow sparse clone into `.cache/repos/`, unless a
 * `HUB_SOURCE_<REPO>` variable points them at a local folder instead.
 */
export function sync(siteDir: string, spaces: Space[]): Placement[] {
  checkOverrides(spaces)
  const checkouts = checkoutRepositories(siteDir, spaces)
  rmSync(join(siteDir, SPACES_DIR), {recursive: true, force: true})
  const placements: Placement[] = []
  for (const space of builtSpaces(spaces)) {
    const spaceDir = join(siteDir, spaceDirOf(space))
    const rootFirst = [...space.sources!]
      .sort((a, b) => Number(a.mount !== undefined) - Number(b.mount !== undefined))
    for (const source of rootFirst) {
      const {from, live} = locate(siteDir, source, checkouts)
      if (!existsSync(from)) throw new Error(`Space "${space.id}": ${describe(source)} has no folder ${from}.`)
      const to = source.mount === undefined ? spaceDir : join(spaceDir, source.mount)
      if (source.mount !== undefined && existsSync(to)) {
        throw new Error(`Space "${space.id}": mount "${source.mount}" clashes with a folder of the same name in the root source.`)
      }
      copyTree(from, to)
      if (source.mount === undefined && !INDEX_FILES.some(file => existsSync(join(from, file)))) {
        throw new Error(`Space "${space.id}": ${describe(source)} needs an index.md, it becomes the space's front page.`)
      }
      const target = source.mount === undefined ? space.id : `${space.id}/${source.mount}`
      const origin = live ? from : `${describe(source)} at ${git(['-C', from, 'rev-parse', '--short', 'HEAD'])}`
      console.log(`[docs-hub] ${target} <- ${origin}`)
      placements.push({space, source, from, to, live})
    }
  }
  return placements
}

/**
 * Keeps every local source folder and its copy in the space identical while the dev server runs.
 *
 * Shortly after any change the whole folder is reconciled rather than the single file an event
 * names, because editors save through temporary files whose removal is not always reported.
 */
export function watchLive(placements: Placement[]): void {
  for (const placement of placements.filter(candidate => candidate.live)) {
    const mounts = new Set(placement.source.mount === undefined
      ? placement.space.sources!.flatMap(source => source.mount === undefined ? [] : [source.mount])
      : [])
    let pending: NodeJS.Timeout | undefined
    watch(placement.from, {recursive: true}, () => {
      clearTimeout(pending)
      pending = setTimeout(() => reconcile(placement.from, placement.to, mounts), 150)
    })
    console.log(`[docs-hub] watching ${placement.from}`)
  }
}

function checkOverrides(spaces: Space[]): void {
  const known = new Set(builtSpaces(spaces).flatMap(space => space.sources!)
    .filter((source): source is RepositorySource => !isLocalSource(source))
    .map(overrideVariableOf))
  const unknown = Object.keys(process.env).filter(name => name.startsWith('HUB_SOURCE_') && !known.has(name))
  if (unknown.length > 0) {
    throw new Error(`${unknown.join(', ')} matches no repository source. Known: ${[...known].join(', ') || 'none'}.`)
  }
}

function checkoutRepositories(siteDir: string, spaces: Space[]): Map<string, string> {
  const wanted = new Map<string, {source: RepositorySource, paths: Set<string>}>()
  for (const source of builtSpaces(spaces).flatMap(space => space.sources!)) {
    if (isLocalSource(source) || process.env[overrideVariableOf(source)]) continue
    const key = checkoutKey(source)
    const entry = wanted.get(key) ?? {source, paths: new Set<string>()}
    entry.paths.add(pathOf(source))
    wanted.set(key, entry)
  }
  const checkouts = new Map<string, string>()
  for (const [key, {source, paths}] of wanted) {
    checkouts.set(key, checkout(join(siteDir, CACHE_DIR, key.replaceAll('/', '__')), source, [...paths]))
  }
  return checkouts
}

function checkout(dir: string, source: RepositorySource, paths: string[]): string {
  const ref = refOf(source)
  if (existsSync(join(dir, '.git'))) {
    git(['-C', dir, 'fetch', '--quiet', '--depth', '1', '--filter=blob:none', '--no-tags', 'origin', ref])
    git(['-C', dir, 'checkout', '--quiet', '--force', '--detach', 'FETCH_HEAD'])
  } else {
    mkdirSync(dirname(dir), {recursive: true})
    git(['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--sparse', '--no-tags', '--branch', ref,
      `https://github.com/${source.repo}.git`, dir])
  }
  git(['-C', dir, 'sparse-checkout', 'set', ...paths])
  return dir
}

function locate(siteDir: string, source: Source, checkouts: Map<string, string>): {from: string, live: boolean} {
  if (isLocalSource(source)) return {from: resolve(siteDir, source.dir), live: true}
  const override = process.env[overrideVariableOf(source)]
  if (override) return {from: resolve(override), live: true}
  return {from: join(checkouts.get(checkoutKey(source))!, pathOf(source)), live: false}
}

function checkoutKey(source: RepositorySource): string {
  return `${source.repo}@${refOf(source)}`
}

function describe(source: Source): string {
  return isLocalSource(source) ? source.dir : `${source.repo}@${refOf(source)}:${pathOf(source)}`
}

function copyTree(from: string, to: string): void {
  cpSync(from, to, {recursive: true, filter: path => !isIgnored(basename(path))})
}

/**
 * Makes `to` match `from`: copies files whose content differs, removes what `from` no longer has.
 * Unchanged files are left alone so the dev server only reloads what was edited. Top-level names in
 * `keep` belong to mounted sources and are never removed.
 */
function reconcile(from: string, to: string, keep: Set<string> = new Set()): void {
  mkdirSync(to, {recursive: true})
  const wanted = new Set(readdirSync(from).filter(name => !isIgnored(name)))
  for (const name of wanted) {
    const source = join(from, name)
    const target = join(to, name)
    if (statSync(source).isDirectory()) {
      if (existsSync(target) && !statSync(target).isDirectory()) rmSync(target)
      reconcile(source, target)
    } else if (!existsSync(target) || !readFileSync(source).equals(readFileSync(target))) {
      rmSync(target, {recursive: true, force: true})
      copyFileSync(source, target)
    }
  }
  for (const name of readdirSync(to)) {
    if (!wanted.has(name) && !keep.has(name)) rmSync(join(to, name), {recursive: true, force: true})
  }
}

function isIgnored(name: string): boolean {
  return name === 'node_modules' || (name.startsWith('.') && name.length > 1)
}

function git(args: string[]): string {
  return execFileSync('git', args, {stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8'}).trim()
}
