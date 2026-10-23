import Link from '@docusaurus/Link'
import {useActivePlugin} from '@docusaurus/plugin-content-docs/client'
import {usePluginData} from '@docusaurus/useGlobalData'
import DocSidebarItems from '@theme-init/DocSidebarItems'
import type DocSidebarItemsType from '@theme/DocSidebarItems'
import type {ComponentProps, ReactNode} from 'react'
import type {HubData} from '../../plugin.ts'

/**
 * The name of the space at the top of its sidebar, with a way back to all spaces and links to the
 * space's Javadoc, so it is always clear which project's docs are open.
 */
function SpaceHeader(): ReactNode {
  const pluginId = useActivePlugin()?.pluginId
  const {spaces} = usePluginData('docs-hub') as HubData
  const space = spaces.find(candidate => candidate.id === pluginId)
  if (space === undefined) return null
  return (
    <li className="hub-space-header">
      <Link className="hub-space-header__all" to="/">All docs</Link>
      <Link className="hub-space-header__title" to={space.to}>{space.title}</Link>
      {space.javadoc.map(javadoc => (
        <a key={javadoc.href} className="hub-space-header__javadoc" href={javadoc.href}>{javadoc.label}</a>
      ))}
    </li>
  )
}

/**
 * The sidebar items as usual, headed by the space name on the top level.
 */
export default function DocSidebarItemsWrapper(props: ComponentProps<typeof DocSidebarItemsType>): ReactNode {
  return (
    <>
      {props.level === 1 && <SpaceHeader/>}
      <DocSidebarItems {...props}/>
    </>
  )
}
