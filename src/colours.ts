import type {Colour, Site, Space} from './types.ts'

const SHADES: [string, number][] = [
  ['-darkest', -0.3],
  ['-darker', -0.15],
  ['-dark', -0.1],
  ['', 0],
  ['-light', 0.1],
  ['-lighter', 0.15],
  ['-lightest', 0.3],
]

/**
 * The stylesheet that gives the site its primary colour and each space its accent, in both colour modes.
 *
 * A space's accent replaces the primary colour on that space's pages, found by the `plugin-id-<id>`
 * class Docusaurus puts on `<html>` for docs pages.
 */
export function colourCss(site: Site, spaces: Space[]): string {
  const rules = [
    rule(':root', primaryVariables(lightOf(site.primary))),
    rule('[data-theme=\'dark\']', primaryVariables(darkOf(site.primary))),
  ]
  for (const space of spaces) {
    const accent = space.accent ?? site.primary
    rules.push(rule(`[data-space='${space.id}']`, accentVariables(accent)))
    if (space.accent === undefined) continue
    rules.push(rule(`html.plugin-id-${space.id}`, primaryVariables(lightOf(space.accent))))
    rules.push(rule(`html.plugin-id-${space.id}[data-theme='dark']`, primaryVariables(darkOf(space.accent))))
  }
  return rules.join('\n')
}

function primaryVariables(hex: string): Record<string, string> {
  return Object.fromEntries(SHADES.map(([suffix, amount]) => [`--ifm-color-primary${suffix}`, shade(hex, amount)]))
}

function accentVariables(accent: Colour): Record<string, string> {
  return {'--hub-accent-light': lightOf(accent), '--hub-accent-dark': darkOf(accent)}
}

function rule(selector: string, variables: Record<string, string>): string {
  return `${selector}{${Object.entries(variables).map(([name, value]) => `${name}:${value};`).join('')}}`
}

function lightOf(colour: Colour): string {
  return typeof colour === 'string' ? colour : colour.light
}

function darkOf(colour: Colour): string {
  return typeof colour === 'string' ? colour : colour.dark
}

/**
 * Darkens (negative amount) or lightens (positive amount) a colour by a share of its own lightness,
 * the way Docusaurus derives its primary colour shades.
 */
function shade(hex: string, amount: number): string {
  const [h, s, l] = toHsl(hex)
  return fromHsl(h, s, Math.min(1, Math.max(0, l + l * amount)))
}

function toHsl(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`Colour "${hex}" must be written as #rrggbb.`)
  const value = parseInt(match[1]!, 16)
  const [r, g, b] = [value >> 16 & 255, value >> 8 & 255, value & 255].map(channel => channel / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function fromHsl(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number): number => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (u < 1 / 6) return p + (q - p) * 6 * u
    if (u < 1 / 2) return q
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
    return p
  }
  const rgb = s === 0 ? [l, l, l] : [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]
  return `#${rgb.map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('')}`
}
