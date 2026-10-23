import type {Options} from '@docusaurus/plugin-content-docs'
import type {Space} from './types.ts'

type SidebarItemsGeneratorOption = NonNullable<Options['sidebarItemsGenerator']>
type Doc = Parameters<SidebarItemsGeneratorOption>[0]['docs'][number]

/**
 * Builds a space's sidebar from its folders: the root source's pages first, then one category per
 * mounted source in the order the space lists them. A mounted source's index page becomes the
 * category's own page.
 */
export function sidebarOf(space: Space): SidebarItemsGeneratorOption {
  const mounts = space.sources!.filter(source => source.mount !== undefined)
  return async ({defaultSidebarItemsGenerator, ...args}) => {
    if (args.item.dirName !== '.' || mounts.length === 0) return defaultSidebarItemsGenerator(args)
    const rootDocs = args.docs.filter(doc => !mounts.some(source => isInside(doc, source.mount!)))
    const rootItems = await defaultSidebarItemsGenerator({...args, docs: rootDocs})
    const mountItems = await Promise.all(mounts.map(async source => {
      const mount = source.mount!
      const docs = args.docs.filter(doc => isInside(doc, mount))
      const index = docs.find(doc => doc.sourceDirName === mount && /^(index|readme)$/i.test(doc.id.split('/').pop()!))
      const items = await defaultSidebarItemsGenerator({
        ...args,
        item: {...args.item, dirName: mount},
        docs: docs.filter(doc => doc !== index),
      })
      return {
        type: 'category' as const,
        label: source.label ?? mount,
        items,
        ...(index ? {link: {type: 'doc' as const, id: index.id}} : {}),
      }
    }))
    return [...rootItems, ...mountItems]
  }
}

function isInside(doc: Doc, mount: string): boolean {
  return doc.sourceDirName === mount || doc.sourceDirName.startsWith(`${mount}/`)
}
