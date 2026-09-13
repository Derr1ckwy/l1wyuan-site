export type NavItemType = 'md' | 'external'

export interface NavExternalLink {
  label: string
  url: string
  icon?: string
}

export interface NavItemBase {
  id: string
  title: string
}

export interface NavMdItem extends NavItemBase {
  type: 'md'
  path: string
}

export interface NavExternalItem extends NavItemBase {
  type: 'external'
  url: string
}

export type NavItem = NavMdItem | NavExternalItem

export interface NavSection {
  id: string
  title: string
  items: NavItem[]
}

export interface NavCategory {
  id: string
  title: string
  description: string
  sections: NavSection[]
}

export interface NavData {
  site: {
    name: string
    tagline: string
    externalLinks: NavExternalLink[]
  }
  categories: NavCategory[]
}
