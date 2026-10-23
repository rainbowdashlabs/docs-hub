const FENCE = /^\s*(`{3,}|~{3,})/
const TITLED_ADMONITION = /^(\s*:{3,}[a-z]+)[ \t]+(\S.*?)\s*$/

/**
 * Rewrites admonitions with a title after the type (`:::tip Some title`) to the directive form
 * (`:::tip[Some title]`), outside code blocks.
 *
 * Docusaurus only understands the first form in MDX files; plain Markdown files show it as text. Both
 * forms are common in the projects' docs, so every page renders either.
 */
export function directiveAdmonitionTitles({fileContent}: {filePath: string, fileContent: string}): string {
  let fence: string | undefined
  return fileContent.split('\n').map(line => {
    const marker = FENCE.exec(line)?.[1]
    if (marker !== undefined && (fence === undefined || marker.startsWith(fence))) {
      fence = fence === undefined ? marker : undefined
      return line
    }
    if (fence !== undefined) return line
    return line.replace(TITLED_ADMONITION, (_, type: string, title: string) => `${type}[${title.replaceAll(']', '\\]')}]`)
  }).join('\n')
}
