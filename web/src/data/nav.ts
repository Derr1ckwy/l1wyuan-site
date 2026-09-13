import type { NavData } from '../types/nav'

// nav.json will be generated during build (from content repo)
import nav from '../generated/nav.json'

const emptyNavData: NavData = {
  site: {
    name: '个人网站',
    tagline: '内容数据暂时不可用，请稍后再试。',
    externalLinks: [],
  },
  categories: [],
}

function isNavData(value: unknown): value is NavData {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<NavData>
  const site = candidate.site

  return (
    !!site &&
    typeof site.name === 'string' &&
    typeof site.tagline === 'string' &&
    Array.isArray(site.externalLinks) &&
    Array.isArray(candidate.categories)
  )
}

export const navData = isNavData(nav) ? nav : emptyNavData
export const navDataError = isNavData(nav) ? '' : '站点内容数据格式不正确，已显示兜底内容。'

export function getCategoryById(categoryId: string) {
  return navData.categories.find((c) => c.id === categoryId)
}

export interface NavPost {
  id: string
  title: string
  categoryId: string
  categoryTitle: string
  sectionTitle: string
  path: string
}

function flattenPosts(): NavPost[] {
  const posts: NavPost[] = []
  for (const cat of navData.categories) {
    for (const section of cat.sections) {
      for (const item of section.items) {
        if (item.type === 'md') {
          posts.push({
            id: item.id,
            title: item.title,
            categoryId: cat.id,
            categoryTitle: cat.title,
            sectionTitle: section.title,
            path: item.path,
          })
        }
      }
    }
  }
  return posts
}

export const navPosts: NavPost[] = flattenPosts()

export function findMdItemByPath(mdPath: string) {
  for (const cat of navData.categories) {
    for (const section of cat.sections) {
      for (const item of section.items) {
        if (item.type === 'md' && item.path === mdPath) return item
      }
    }
  }
  return undefined
}
