import {Resvg} from '@resvg/resvg-js'
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, extname, join} from 'node:path'
import satori from 'satori'
import {bands, darkOf} from './colours.ts'
import type {Colour, Site} from './types.ts'

export const CARDS_DIR = 'og'
const WIDTH = 1200
const HEIGHT = 630
const require = createRequire(import.meta.url)

/**
 * One page's preview card: the large image chat apps such as Discord show for a link.
 */
export interface Card {
  permalink: string
  title: string
  description?: string
  space?: {title: string, accent: Colour}
}

interface Node {
  type: string
  props: {style?: Record<string, string | number>, children?: (Node | string)[] | Node | string, [key: string]: unknown}
}

/**
 * The address of a page's card, relative to the site root: `og/<permalink>.png`, and `og/index.png`
 * for the landing page.
 */
export function cardPathOf(permalink: string): string {
  const path = permalink.replace(/^\/+|\/+$/g, '')
  return `${CARDS_DIR}/${path === '' ? 'index' : path}.png`
}

/**
 * Renders every card as a PNG into the build output.
 */
export async function writeCards(site: Site, siteDir: string, outDir: string, cards: Card[]): Promise<void> {
  const fonts = [400, 700].map(weight => ({
    name: 'Noto Sans',
    weight: weight as 400 | 700,
    style: 'normal' as const,
    data: readFileSync(require.resolve(`@fontsource/noto-sans/files/noto-sans-latin-${weight}-normal.woff`)),
  }))
  const logo = site.logo === undefined ? undefined : dataUrl(join(siteDir, 'static', site.logo.src))
  for (const card of cards) {
    const svg = await satori(layout(site, card, logo) as never, {width: WIDTH, height: HEIGHT, fonts})
    const file = join(outDir, ...cardPathOf(card.permalink).split('/'))
    mkdirSync(dirname(file), {recursive: true})
    writeFileSync(file, new Resvg(svg).render().asPng())
  }
  console.log(`[docs-hub] rendered ${cards.length} preview cards`)
}

function layout(site: Site, card: Card, logo: string | undefined): Node {
  const accent = darkOf(card.space?.accent ?? site.primary)
  const heading: (Node | string)[] = []
  if (card.space) heading.push(div({fontSize: 34, fontWeight: 700, color: accent}, card.space.title))
  heading.push(
    div({fontSize: card.title.length > 40 ? 60 : 76, fontWeight: 700, lineHeight: 1.1, color: '#ffffff'}, card.title),
  )
  if (card.description) heading.push(div({fontSize: 30, lineHeight: 1.4, color: '#b0b3b8'}, shorten(card.description, 150)))
  const footer: (Node | string)[] = []
  if (logo !== undefined) footer.push({type: 'img', props: {src: logo, width: 72, height: 72}})
  footer.push(div({fontSize: 30, color: '#b0b3b8'}, `${site.title} · ${new URL(site.url).host}`))
  return div({width: WIDTH, height: HEIGHT, background: '#1b1b1d', fontFamily: 'Noto Sans'}, [
    div({width: 24, height: HEIGHT, ...(site.stripe ? {backgroundImage: bands(site.stripe, 'to bottom')} : {background: accent})}, []),
    div({flexGrow: 1, flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px'}, [
      div({flexDirection: 'column', gap: 24}, heading),
      div({alignItems: 'center', gap: 24}, footer),
    ]),
  ])
}

function div(style: Record<string, string | number>, children: (Node | string)[] | string): Node {
  return {type: 'div', props: {style: {display: 'flex', ...style}, children}}
}

function shorten(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length).replace(/\s+\S*$/, '')}…`
}

function dataUrl(file: string): string {
  const type = extname(file) === '.svg' ? 'image/svg+xml' : `image/${extname(file).slice(1)}`
  return `data:${type};base64,${readFileSync(file).toString('base64')}`
}
