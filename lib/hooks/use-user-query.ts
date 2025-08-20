import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUserStore } from '@/lib/stores/user-store'
import type { UserProfile } from '@/lib/user/types'

const USER_QUERY_KEY = ['user'] as const

async function fetchUserProfile(): Promise<UserProfile | null> {
  const response = await fetch('/api/user')
  if (!response.ok) {
    if (response.status === 401) return null
    throw new Error('Failed to fetch user profile')
  }
  return response.json()
}

async function updateUserProfile(
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const response = await fetch('/api/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!response.ok) throw new Error('Failed to update user profile')
  return response.json()
}

export function useUserQuery() {
  const queryClient = useQueryClient()
  const { setUser, setLoading, setError } = useUserStore()
  
  const query = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: fetchUserProfile,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('401')) return false
      return failureCount < 2
    },
    onSuccess: (data) => {
      setUser(data)
      setLoading(false)
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Unknown error')
    },
  })
  
  const updateMutation = useMutation({
    mutationFn: updateUserProfile,
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEY })
      const previousUser = queryClient.getQueryData<UserProfile>(USER_QUERY_KEY)
      
      if (previousUser) {
        const optimisticUser = { ...previousUser, ...updates }
        queryClient.setQueryData(USER_QUERY_KEY, optimisticUser)
        setUser(optimisticUser)
      }
      
      return { previousUser }
    },
    onError: (err, updates, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(USER_QUERY_KEY, context.previousUser)
        setUser(context.previousUser)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(USER_QUERY_KEY, data)
      setUser(data)
    },
  })
  
  return {
    user: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateUser: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  }
}