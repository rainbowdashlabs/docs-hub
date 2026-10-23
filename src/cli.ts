#!/usr/bin/env node
import {spawn} from 'node:child_process'
import {createRequire} from 'node:module'
import {join, resolve} from 'node:path'
import createJiti from 'jiti'
import {validate} from './spaces.ts'
import {sync, watchLive} from './sync.ts'
import type {Site, Space} from './types.ts'

const USAGE = `Usage: docs-hub <sync|start|build> [site dir] [docusaurus options]

  sync    gather every space's sources into .spaces/
  start   sync, then run the dev server and keep local sources in sync
  build   sync, then build the static site

Set HUB_SOURCE_<REPO>=<folder> to use a local docs folder instead of fetching that repository.`

/**
 * Reads the hub's `site.ts` and `spaces.ts` from the site directory, with the same TypeScript loader
 * Docusaurus uses for its config, so they load the same way in both places.
 */
function loadHub(siteDir: string): {site: Site, spaces: Space[]} {
  const load = createJiti(join(siteDir, 'docusaurus.config.ts'), {interopDefault: true})
  const site = load(join(siteDir, 'site.ts')) as Site
  const spaces = load(join(siteDir, 'spaces.ts')) as Space[]
  validate(site, spaces)
  return {site, spaces}
}

/**
 * Runs the Docusaurus CLI that the site directory resolves to and resolves with its exit code.
 */
function docusaurus(siteDir: string, args: string[]): Promise<number> {
  const bin = createRequire(join(siteDir, 'package.json')).resolve('@docusaurus/core/bin/docusaurus.mjs')
  const child = spawn(process.execPath, [bin, ...args], {stdio: 'inherit'})
  return new Promise(done => child.on('exit', code => done(code ?? 1)))
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv
  const siteDir = resolve(rest[0] && !rest[0].startsWith('-') ? rest.shift()! : '.')
  if (!['sync', 'start', 'build'].includes(command ?? '')) {
    console.error(USAGE)
    return 2
  }
  const {spaces} = loadHub(siteDir)
  const placements = sync(siteDir, spaces)
  if (command === 'sync') return 0
  if (command === 'start') watchLive(placements)
  return docusaurus(siteDir, [command!, siteDir, ...rest])
}

main(process.argv.slice(2)).then(code => process.exit(code), error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
