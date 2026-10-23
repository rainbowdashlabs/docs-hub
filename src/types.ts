/**
 * A colour for light mode and one for dark mode, or one colour used for both.
 */
export type Colour = string | {light: string, dark: string}

/**
 * A link shown in the navbar or the footer.
 */
export interface Link {
  label: string
  href: string
}

/**
 * A column of links in the footer.
 */
export interface FooterColumn {
  title: string
  items: Link[]
}

/**
 * A heading on the landing page and a dropdown in the navbar. Every space belongs to one group.
 */
export interface Group {
  id: string
  label: string
}

/**
 * Everything that makes one hub different from another: its name, address, look and links.
 *
 * `redirects` maps old paths, for example those of a previous site, to a route of this hub or to an
 * absolute URL. The build fails when a route target does not exist.
 *
 * `mavenRepositories` are searched in order for the Javadoc of the spaces; Maven Central when unset.
 *
 * `stripe` is a list of colours shown as equal bands: a thin line under the navbar and the edge of the
 * preview cards. `customCss` lists extra stylesheets of the hub, relative to the site directory.
 */
export interface Site {
  title: string
  tagline: string
  url: string
  baseUrl?: string
  favicon: string
  logo?: {src: string, alt: string}
  primary: Colour
  groups: Group[]
  navbarLinks?: Link[]
  footer?: FooterColumn[]
  copyright?: string
  redirects?: Record<string, string>
  mavenRepositories?: string[]
  stripe?: string[]
  customCss?: string[]
}

/**
 * A folder of Markdown pages inside a GitHub repository.
 *
 * `path` defaults to `docs`, `ref` to `main`. A space with several sources mounts all but one of them
 * under `mount`, which becomes a sidebar category labelled `label`.
 */
export interface RepositorySource {
  repo: string
  ref?: string
  path?: string
  mount?: string
  label?: string
}

/**
 * A folder of Markdown pages inside the hub itself, relative to the site directory.
 */
export interface LocalSource {
  dir: string
  mount?: string
  label?: string
}

export type Source = RepositorySource | LocalSource

/**
 * A published API whose released `-javadoc.jar` the hub serves inside a space. `artifact` is
 * `group:name`; `version` defaults to the newest version without a pre-release qualifier such as
 * `-alpha1`, `-RC2` or `-DEV`.
 */
export interface JavadocArtifact {
  artifact: string
  label?: string
  version?: string
}

/**
 * One project's documentation: its own route, sidebar, search context and accent colour.
 *
 * A space either has `sources`, which the hub builds, or an `href` to documentation hosted elsewhere.
 * A built space can also serve the Javadoc of its APIs under `/<id>/javadoc/`.
 */
export interface Space {
  id: string
  title: string
  description: string
  group: string
  accent?: Colour
  sources?: Source[]
  href?: string
  javadoc?: JavadocArtifact[]
}
