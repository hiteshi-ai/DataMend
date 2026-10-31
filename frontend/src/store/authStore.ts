import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, ThemeKey, Language } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAdmin: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAdmin: false,
      isLoading: false,
      setUser: (user) =>
        set({
          user,
          isAdmin: user?.role === 'admin',
        }),
      setToken: (token) => {
        if (token) {
          localStorage.setItem('datamend_token', token)
        } else {
          localStorage.removeItem('datamend_token')
        }
        set({ token })
      },
      logout: () => {
        localStorage.removeItem('datamend_token')
        set({ user: null, token: null, isAdmin: false })
      },
      setLoading: (v) => set({ isLoading: v }),
    }),
    {
      name: 'datamend_auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAdmin: state.isAdmin,
      }),
    }
  )
)

// Convenience selectors
export const selectUser = (s: AuthState) => s.user
export const selectToken = (s: AuthState) => s.token
export const selectIsAdmin = (s: AuthState) => s.isAdmin
export const selectIsLoading = (s: AuthState) => s.isLoading

// Helper: update theme/language in user object without full re-login
export function updateUserPreferences(
  update: Partial<Pick<User, 'theme' | 'language' | 'display_name'>>
) {
  useAuthStore.setState((state) => ({
    user: state.user ? { ...state.user, ...update } : null,
  }))
}

export type { AuthState }
