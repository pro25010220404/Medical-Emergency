import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiGet, clearAuthTokens, login as apiLogin } from '../lib/apiClient'

type AuthUser = Record<string, unknown> | null

type AuthContextValue = {
  /** 已完成一次登录尝试（成功或失败） */
  ready: boolean
  /** 已持有有效 JWT 且 /auth/me 成功 */
  authenticated: boolean
  user: AuthUser
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthUser>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshMe = useCallback(async () => {
    const me = await apiGet<AuthUser>('/auth/me')
    setUser(me)
    setError(null)
    setAuthenticated(true)
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      clearAuthTokens()
      await apiLogin(username, password)
      await refreshMe()
    },
    [refreshMe],
  )

  const logout = useCallback(() => {
    clearAuthTokens()
    setUser(null)
    setAuthenticated(false)
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await apiLogin()
        if (cancelled) return
        await refreshMe()
      } catch (e) {
        if (!cancelled) {
          clearAuthTokens()
          setUser(null)
          setAuthenticated(false)
          setError(String(e instanceof Error ? e.message : e))
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshMe])

  const value = useMemo(
    () => ({ ready, authenticated, user, error, login, logout, refreshMe }),
    [ready, authenticated, user, error, login, logout, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 需在 AuthProvider 内使用')
  return ctx
}
