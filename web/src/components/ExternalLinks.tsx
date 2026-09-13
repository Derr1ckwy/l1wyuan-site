import type { NavExternalLink } from '../types/nav'

export function ExternalLinks({ links }: { links: NavExternalLink[] }) {
  return (
    <div className="externalLinks">
      {links.map((l) => (
        <a
          key={l.label}
          className="pill"
          href={l.url}
          target="_blank"
          rel="noreferrer"
        >
          {l.label}
        </a>
      ))}
    </div>
  )
}
