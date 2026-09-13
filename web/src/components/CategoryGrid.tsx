import { Link } from 'react-router-dom'
import { navData } from '../data/nav'

export function CategoryGrid() {
  return (
    <div className="grid">
      {navData.categories.map((c) => (
        <Link key={c.id} className="card" to={`/c/${c.id}`}>
          <div className="cardTitle">{c.title}</div>
          <div className="cardDesc">{c.description}</div>
          <div className="cardCta">进入</div>
        </Link>
      ))}
    </div>
  )
}
