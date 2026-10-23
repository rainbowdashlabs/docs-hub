import Head from '@docusaurus/Head'
import {useActivePlugin, useDoc} from '@docusaurus/plugin-content-docs/client'
import {usePluginData} from '@docusaurus/useGlobalData'
import {PageMetadata} from '@docusaurus/theme-common'
import type {ReactNode} from 'react'
import type {HubData} from '../../../plugin.ts'

/**
 * The page metadata as usual, with the page's generated preview card as its image unless the page
 * names one, and the space's colour as theme colour, which chat apps use for the link preview.
 */
export default function DocItemMetadata(): ReactNode {
  const {metadata, frontMatter, assets} = useDoc()
  const pluginId = useActivePlugin()?.pluginId
  const {spaces} = usePluginData('docs-hub') as HubData
  const space = spaces.find(candidate => candidate.id === pluginId)
  const card = `og${metadata.permalink.replace(/\/+$/, '')}.png`
  return (
    <>
      <PageMetadata
        title={metadata.title}
        description={metadata.description}
        keywords={frontMatter.keywords}
        image={assets.image ?? frontMatter.image ?? card}
      />
      {space !== undefined && (
        <Head>
          <meta name="theme-color" content={space.colour}/>
        </Head>
      )}
    </>
  )
}
