import type { NavData, NavItem } from '../types/nav'

export interface NavPost {
  id: string
  title: string
  categoryId: string
  categoryTitle: string
  sectionTitle: string
  path: string
}

// 纯函数：从任意 NavData 提取/查找，组件里配合 useNav() 使用
export function flattenPosts(nav: NavData): NavPost[] {
  const posts: NavPost[] = []
  for (const cat of nav.categories) {
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

export function findMdItemByPath(nav: NavData, mdPath: string): NavItem | undefined {
  for (const cat of nav.categories) {
    for (const section of cat.sections) {
      for (const item of section.items) {
        if (item.type === 'md' && item.path === mdPath) return item
      }
    }
  }
  return undefined
}
