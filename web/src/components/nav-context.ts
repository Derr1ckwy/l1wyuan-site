import { createContext, useContext } from 'react'
import { navData as staticNav } from '../data/nav'
import type { NavData } from '../types/nav'

export type NavContextValue = {
  nav: NavData
  /** 写操作（新建栏目/条目）后调用，从 API 重读最新导航 */
  refreshNav: () => void
}

export const NavContext = createContext<NavContextValue>({ nav: staticNav, refreshNav: () => {} })

export function useNav(): NavContextValue {
  return useContext(NavContext)
}
