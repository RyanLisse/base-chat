"use client"

import { useUserQuery } from '@/lib/hooks/use-user-query'
import { useUserStore } from '@/lib/stores/user-store'
import type { UserProfile } from '@/lib/user/types'
import { createContext, useContext, ReactNode } from 'react'

interface UserContextType {
  user: UserProfile | null
  isLoading: boolean
  error: Error | null
  updateUser: (updates: Partial<UserProfile>) => void
  refetch: () => void
  isUpdating: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function OptimizedUserProvider({
  children,
  initialUser,
}: {
  children: ReactNode
  initialUser?: UserProfile | null
}) {
  const { user, isLoading, error, refetch, updateUser, isUpdating } = useUserQuery()
  const storeUser = useUserStore((state) => state.user)
  
  const contextValue: UserContextType = {
    user: user ?? storeUser ?? initialUser ?? null,
    isLoading,
    error: error as Error | null,
    updateUser,
    refetch,
    isUpdating,
  }
  
  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  )
}

export function useOptimizedUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useOptimizedUser must be used within OptimizedUserProvider')
  }
  return context
}