import { Link } from 'react-router-dom'
import { useNav } from './nav-context'

export function CategoryGrid() {
  const { nav } = useNav()
  return (
    <div className="grid">
      {nav.categories.map((c) => (
        <Link key={c.id} className="card" to={`/c/${c.id}`}>
          <div className="cardTitle">{c.title}</div>
          <div className="cardDesc">{c.description}</div>
          <div className="cardCta">进入</div>
        </Link>
      ))}
    </div>
  )
}
