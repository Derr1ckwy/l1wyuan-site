import { Link } from 'react-router-dom'

export function Logo({ name }: { name: string }) {
  return (
    <Link to="/" className="logo">
      {name}
    </Link>
  )
}
