import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { navData as staticNav } from '../data/nav'
import type { NavData } from '../types/nav'
import { NavContext } from './nav-context'

// 导航运行时加载：静态构建副本打底，API 可达时用内容仓库的最新 nav.json 覆盖。
// 这样新建栏目/条目后无需等重建即可见。
export function NavProvider({ children }: { children: ReactNode }) {
  const [nav, setNav] = useState<NavData>(staticNav)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/api/public/nav', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { navJson?: string } | null) => {
        if (!alive || !json?.navJson) return
        try {
          const parsed = JSON.parse(json.navJson) as NavData
          if (parsed && Array.isArray(parsed.categories)) setNav(parsed)
        } catch {
          // 忽略格式错误的导航，保留静态副本
        }
      })
      .catch(() => {
        // API 不可达（纯静态部署），用静态副本
      })
    return () => {
      alive = false
    }
  }, [tick])

  return (
    <NavContext.Provider value={{ nav, refreshNav: () => setTick((t) => t + 1) }}>
      {children}
    </NavContext.Provider>
  )
}
