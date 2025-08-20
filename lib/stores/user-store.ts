import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { UserProfile } from '@/lib/user/types'

interface UserState {
  user: UserProfile | null
  isLoading: boolean
  error: string | null
}

interface UserActions {
  setUser: (user: UserProfile | null) => void
  updateUser: (updates: Partial<UserProfile>) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

type UserStore = UserState & UserActions

const initialState: UserState = {
  user: null,
  isLoading: false,
  error: null,
}

export const useUserStore = create<UserStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set) => ({
          ...initialState,
          
          setUser: (user) =>
            set((state) => {
              state.user = user
              state.error = null
            }),
          
          updateUser: (updates) =>
            set((state) => {
              if (state.user) {
                Object.assign(state.user, updates)
              }
            }),
          
          setLoading: (isLoading) =>
            set((state) => {
              state.isLoading = isLoading
            }),
          
          setError: (error) =>
            set((state) => {
              state.error = error
              state.isLoading = false
            }),
          
          reset: () => set(initialState),
        })),
        {
          name: 'user-store',
          partialize: (state) => ({ user: state.user }),
        }
      )
    ),
    {
      name: 'user-store',
    }
  )
)

export const userStoreSelectors = {
  user: (state: UserStore) => state.user,
  isLoading: (state: UserStore) => state.isLoading,
  error: (state: UserStore) => state.error,
  isAuthenticated: (state: UserStore) => !!state.user?.id,
}