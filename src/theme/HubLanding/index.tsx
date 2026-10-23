import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import {usePluginData} from '@docusaurus/useGlobalData'
import Heading from '@theme/Heading'
import Layout from '@theme/Layout'
import type {ReactNode} from 'react'
import type {HubData} from '../../plugin.ts'

type SpaceEntry = HubData['spaces'][number]

function SpaceCard({space}: {space: SpaceEntry}): ReactNode {
  const external = space.href !== undefined
  return (
    <Link className="hub-card" data-space={space.id} to={space.to} href={space.href}>
      <span className="hub-card__title">
        {space.title}
        {external && <span className="hub-card__external" aria-label="hosted elsewhere"> ↗</span>}
      </span>
      <span className="hub-card__description">{space.description}</span>
    </Link>
  )
}

/**
 * The hub's front page: the site's name and tagline, then a card for every space, grouped.
 */
export default function HubLanding(): ReactNode {
  const {siteConfig} = useDocusaurusContext()
  const {groups, spaces} = usePluginData('docs-hub') as HubData
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <header className="hub-hero">
        <div className="container">
          <Heading as="h1">{siteConfig.title}</Heading>
          <p className="hub-hero__tagline">{siteConfig.tagline}</p>
        </div>
      </header>
      <main className="container hub-groups">
        {groups.map(group => {
          const members = spaces.filter(space => space.group === group.id)
          if (members.length === 0) return null
          return (
            <section key={group.id} className="hub-group">
              <Heading as="h2">{group.label}</Heading>
              <div className="hub-cards">
                {members.map(space => <SpaceCard key={space.id} space={space}/>)}
              </div>
            </section>
          )
        })}
      </main>
    </Layout>
  )
}
