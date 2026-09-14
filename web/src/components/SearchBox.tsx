import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNav } from './nav-context'
import { flattenPosts } from '../lib/nav-helpers'

export function SearchBox() {
  const [q, setQ] = useState('')
  const { nav } = useNav()

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []

    const categoryResults = nav.categories
      .filter((category) => category.title.toLowerCase().includes(query))
      .map((category) => ({
        label: `栏目：${category.title}`,
        href: `/c/${category.id}`,
      }))

    const postResults = flattenPosts(nav)
      .filter((post) => post.title.toLowerCase().includes(query))
      .map((post) => ({
        label: `${post.categoryTitle} / ${post.title}`,
        href: `/p/${post.path}`,
      }))

    return [...categoryResults, ...postResults].slice(0, 8)
  }, [q, nav])

  return (
    <div className="search">
      <input
        className="searchInput"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索栏目或文章..."
        aria-label="Search"
      />

      {q.trim() && results.length > 0 ? (
        <div className="searchResults">
          {results.map((r) => (
            <Link key={`${r.label}-${r.href}`} className="searchResult" to={r.href}>
              {r.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
