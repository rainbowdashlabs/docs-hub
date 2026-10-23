import type {JavadocArtifact, LocalSource, RepositorySource, Site, Source, Space} from './types.ts'

export const SPACES_DIR = '.spaces'
export const CACHE_DIR = '.cache/repos'

export function isRepositorySource(source: Source): source is RepositorySource {
  return 'repo' in source
}

export function isLocalSource(source: Source): source is LocalSource {
  return 'dir' in source
}

export function refOf(source: RepositorySource): string {
  return source.ref ?? 'main'
}

export function pathOf(source: RepositorySource): string {
  return (source.path ?? 'docs').replace(/^\/+|\/+$/g, '')
}

/**
 * The environment variable that replaces a repository source with a local folder, for example
 * `HUB_SOURCE_COMPANIES` for `eldoriarpg/companies`.
 */
export function overrideVariableOf(source: RepositorySource): string {
  const name = source.repo.split('/').pop() ?? source.repo
  return `HUB_SOURCE_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
}

/**
 * The folder, relative to the site directory, that a space's pages are gathered into.
 */
export function spaceDirOf(space: Space): string {
  return `${SPACES_DIR}/${space.id}`
}

export function builtSpaces(spaces: Space[]): Space[] {
  return spaces.filter(space => space.sources !== undefined)
}

/**
 * Fails with every mistake in the hub configuration at once, so a broken `spaces.ts` is fixed in one go.
 */
export function validate(site: Site, spaces: Space[]): void {
  const problems: string[] = []
  const groups = new Set(site.groups.map(group => group.id))
  const ids = new Set<string>()
  for (const space of spaces) {
    const name = `Space "${space.id}"`
    if (!/^[a-z0-9][a-z0-9-]*$/.test(space.id)) problems.push(`${name}: id must be lower-case letters, digits and dashes.`)
    if (ids.has(space.id)) problems.push(`${name}: id is used twice.`)
    ids.add(space.id)
    if (!groups.has(space.group)) problems.push(`${name}: group "${space.group}" is not in site.groups.`)
    if ((space.sources === undefined) === (space.href === undefined)) problems.push(`${name}: needs either sources or href.`)
    if (space.javadoc !== undefined && space.sources === undefined) problems.push(`${name}: javadoc needs a built space with sources.`)
    for (const artifact of space.javadoc ?? []) {
      if (!/^[^:\s]+:[^:\s]+$/.test(artifact.artifact)) problems.push(`${name}: javadoc artifact "${artifact.artifact}" must be group:name.`)
    }
    if (space.sources === undefined) continue
    if (space.sources.length === 0) problems.push(`${name}: sources is empty.`)
    const roots = space.sources.filter(source => source.mount === undefined)
    if (roots.length !== 1) problems.push(`${name}: exactly one source must have no mount, found ${roots.length}.`)
    const mounts = space.sources.flatMap(source => source.mount === undefined ? [] : [source.mount])
    if (new Set(mounts).size !== mounts.length) problems.push(`${name}: a mount is used twice.`)
    for (const mount of mounts) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(mount)) problems.push(`${name}: mount "${mount}" must be a single lower-case folder name.`)
    }
  }
  if (problems.length > 0) throw new Error(`The hub configuration is invalid:\n  ${problems.join('\n  ')}`)
}

export const JAVADOC_DIR = '.javadoc'

/**
 * The route of one Javadoc inside its space: `/<id>/javadoc/` for a single API, and one folder per
 * artifact name below it when a space has several.
 */
export function javadocRouteOf(space: Space, artifact: JavadocArtifact): string {
  const several = (space.javadoc?.length ?? 0) > 1
  return several ? `/${space.id}/javadoc/${artifactName(artifact)}/` : `/${space.id}/javadoc/`
}

export function artifactName(artifact: JavadocArtifact): string {
  return artifact.artifact.split(':')[1] ?? artifact.artifact
}
