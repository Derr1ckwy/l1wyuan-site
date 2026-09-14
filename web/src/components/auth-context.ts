import { createContext, useContext } from 'react'
import type { AuthState } from '../lib/auth'

type AuthContextValue = {
  auth: AuthState
  refresh: () => void
  logoutAndRefresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  auth: { status: 'unknown' },
  refresh: () => {},
  logoutAndRefresh: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}
