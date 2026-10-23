# docs-hub

A Docusaurus hub that gathers the `docs/` folders of many repositories into one site, with a separate space
for each project: its own route, sidebar, search, accent colour, Javadoc and link previews, tied together by
a navbar, a landing page and one look.

Used by [docs.eldoria.de](https://docs.eldoria.de) (`eldoriarpg/docs`) and [docs.chojo.dev](https://docs.chojo.dev)
(`rainbowdashlabs/docs`).

## Build a hub

A hub is a small repository with four files and the package as a dependency:

```json
{
  "type": "commonjs",
  "scripts": {
    "start": "docs-hub start",
    "build": "docs-hub build",
    "sync": "docs-hub sync"
  },
  "dependencies": {
    "@docusaurus/core": "3.10.2",
    "@mdx-js/react": "^3.1.1",
    "docs-hub": "github:rainbowdashlabs/docs-hub#v1.0.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1"
  }
}
```

The package is built from source when npm installs it, so the machine needs `git`. Keep the hub's own
`package.json` without `"type": "module"`: Docusaurus generates CommonJS files into the site directory.

`docusaurus.config.ts`:

```ts
import {createHubConfig} from 'docs-hub'
import site from './site'
import spaces from './spaces'

export default createHubConfig(site, spaces)
```

`site.ts` describes the hub, `spaces.ts` its projects. The types `Site` and `Space` in
[`src/types.ts`](src/types.ts) document every option; `example/` is a complete hub.

```ts
export default {
  title: 'Example Docs',
  tagline: 'One sentence for the landing page.',
  url: 'https://docs.example.org',
  favicon: 'img/favicon.png',
  logo: {src: 'img/logo.png', alt: 'Example'},
  primary: {light: '#2e7d32', dark: '#66bb6a'},
  groups: [{id: 'libraries', label: 'Libraries'}],
  mavenRepositories: ['https://repo1.maven.org/maven2'],
} satisfies Site
```

```ts
export default [
  {
    id: 'my-library',
    title: 'My Library',
    description: 'One sentence for the landing page.',
    group: 'libraries',
    accent: {light: '#1565c0', dark: '#64b5f6'},
    sources: [{repo: 'owner/my-library'}],
    javadoc: [{artifact: 'org.example:my-library'}],
  },
] satisfies Space[]
```

### What a hub gets

- **Spaces.** Each space is built from one or more `docs/` folders (`ref` defaults to `main`, `path` to `docs`).
  Extra sources get a `mount` folder and `label` and appear as sidebar categories after the main pages.
  A space with `href` instead of `sources` links to docs hosted elsewhere.
- **Javadoc.** `javadoc` lists published artifacts. The newest release without a pre-release qualifier across all
  `mavenRepositories` is downloaded and served at `/<space>/javadoc/` (one folder per artifact when there are
  several), restyled with the hub's look and the space's accent. Docs pages link it with
  `pathname:///<space>/javadoc/`.
- **Link previews.** Every page gets a generated card (`og/<page>.png`) and the space's colour as `theme-color`,
  which Discord and other chat apps show for a posted link.
- **Redirects.** `redirects` in `site.ts` maps old paths to routes or URLs. They are written to
  `nginx-redirects.conf` in the build output, together with the rules Javadoc needs; the build fails when a route
  target does not exist.
- **Look.** `primary` and per-space `accent` colours, `stripe` for a band of colours under the navbar and on the
  preview cards, `customCss` for extra stylesheets.
- **Markdown.** Plain `.md` is read as CommonMark. Admonition titles work in both forms, `:::tip Title` and
  `:::tip[Title]`.

### Develop

```sh
npm ci
npm start                          # fetch every space and run the dev server
HUB_SOURCE_MY_LIBRARY=../my-library/docs npm start   # use a local folder instead of fetching
npm run build                      # static site in build/
```

The override variable is `HUB_SOURCE_` plus the repository name in upper case, with anything but letters and
digits as `_`. Local folders are mirrored into the dev server on every save.

### Serve

The build output is static files plus `nginx-redirects.conf`. With nginx, include that file in the server block
and serve the rest with:

```nginx
location / {
    rewrite ^(.+)/$ $1 permanent;
    try_files $uri $uri.html $uri/index.html =404;
}
error_page 404 /404.html;
```

## Set up a project repository

`docs/index.md` is the space's front page. The sidebar follows the folders; order pages with
`sidebar_position` front matter and name folders with `_category_.json`. Link within the project relatively
(`./commands.md`) and to other spaces absolutely (`/other-space`). Broken links and anchors fail the build.

`.github/workflows/docs.yml`:

```yaml
name: Docs

on:
  push:
    paths: ['docs/**', '.github/workflows/docs.yml']
  pull_request:

jobs:
  docs:
    uses: rainbowdashlabs/docs-hub/.github/workflows/space.yml@v1
    with:
      hub-repository: owner/docs
      app-id: ${{ vars.DOCS_APP_ID }}
    secrets:
      DOCS_APP_PRIVATE_KEY: ${{ secrets.DOCS_APP_PRIVATE_KEY }}
```

On every pull request it reports a `docs / verify` check, so branch protection can require it. When the pull request
changes the docs folder or `docs.yml`, it builds the hub with those docs in place of the published ones; otherwise it
passes without building. The repository must already be a source in the hub's `spaces.ts`. Keep the `paths` filter
on `push` only.

On a push to the default branch it asks the hub to rebuild through a GitHub App: the variable `DOCS_APP_ID` and the
secret `DOCS_APP_PRIVATE_KEY` must be available to the repository, and the App needs "Contents: write" on the hub
repository. Pass both explicitly as above: `secrets: inherit` and the caller's variables only reach reusable
workflows of the same owner, and this one lives in `rainbowdashlabs`. A hub that rebuilds on a schedule instead
passes `rebuild: false` and needs no App. Inputs: `hub-repository` (required), `hub-ref` (default `main`),
`docs-path` (default `docs`), `rebuild` (default `true`), `app-id`.

## Develop the package

```sh
nix-shell              # or any Node 24
npm ci                 # also builds dist/
npm run typecheck
npm run example:start  # the example hub, from dist/
```

`npm run build` compiles `src/` to `dist/`. Releases are `vX.Y.Z` tags; the reusable workflow is also tagged
`v1` for the current major version.

## License

LGPL-3.0-or-later, see [LICENSE.md](LICENSE.md).
