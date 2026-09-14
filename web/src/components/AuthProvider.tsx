import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchMe, logout } from '../lib/auth'
import type { AuthState } from '../lib/auth'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'unknown' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    fetchMe().then((a) => {
      if (alive) setAuth(a)
    })
    return () => {
      alive = false
    }
  }, [tick])

  return (
    <AuthContext.Provider
      value={{
        auth,
        refresh: () => setTick((t) => t + 1),
        logoutAndRefresh: async () => {
          await logout()
          setAuth({ status: 'guest' })
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
