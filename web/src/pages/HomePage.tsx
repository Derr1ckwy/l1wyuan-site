import { navDataError } from '../data/nav'
import { useNav } from '../components/nav-context'
import { flattenPosts } from '../lib/nav-helpers'
import { CategoryGrid } from '../components/CategoryGrid'
import { ExternalLinks } from '../components/ExternalLinks'
import { SearchBox } from '../components/SearchBox'

export function HomePage() {
  const { nav } = useNav()
  const latestPosts = flattenPosts(nav).slice(0, 5)

  return (
    <div className="home">
      <header className="hero">
        <div className="heroTitle">{nav.site.name}</div>
        <div className="heroTagline">{nav.site.tagline}</div>
        <div className="heroRow">
          <ExternalLinks links={nav.site.externalLinks} />
          <SearchBox />
        </div>
      </header>

      {navDataError ? <section className="notice">{navDataError}</section> : null}

      <section className="block">
        <div className="blockTitle">栏目</div>
        {nav.categories.length > 0 ? <CategoryGrid /> : (
          <div className="muted">当前没有可展示的分类内容。</div>
        )}
      </section>

      <section className="block">
        <div className="blockTitle">最近内容</div>
        <div className="items">
          {latestPosts.map((post) => (
            <a key={`${post.categoryId}/${post.id}`} className="item" href={`/p/${post.path}`}>
              {post.title}
              <span className="itemMeta">{post.categoryTitle}</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="muted">© {new Date().getFullYear()} {nav.site.name}</div>
      </footer>
    </div>
  )
}
