import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { navData, navPosts } from '../data/nav'

export function SearchBox() {
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []

    const categoryResults = navData.categories
      .filter((category) => category.title.toLowerCase().includes(query))
      .map((category) => ({
        label: `栏目：${category.title}`,
        href: `/c/${category.id}`,
      }))

    const postResults = navPosts
      .filter((post) => post.title.toLowerCase().includes(query))
      .map((post) => ({
        label: `${post.categoryTitle} / ${post.title}`,
        href: `/p/${post.path}`,
      }))

    return [...categoryResults, ...postResults].slice(0, 8)
  }, [q])

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
