import { afterEach, describe, expect, it } from 'vitest'
import { userStoreSelectors, useUserStore } from '../..//lib/stores/user-store'

// Helper to reset after each test
afterEach(() => {
  useUserStore.getState().reset()
})

describe('stores/user-store', () => {
  it('sets and updates user, authenticates when user has id', () => {
    const { setUser, updateUser } = useUserStore.getState()

    setUser({ id: 'u1', name: 'Alice' } as any)
    expect(userStoreSelectors.isAuthenticated(useUserStore.getState())).toBe(true)
    expect(userStoreSelectors.user(useUserStore.getState())).toMatchObject({ name: 'Alice' })

    updateUser({ name: 'Alice Smith' })
    expect(userStoreSelectors.user(useUserStore.getState())).toMatchObject({ name: 'Alice Smith' })
  })

  it('manages loading and error states', () => {
    const { setLoading, setError } = useUserStore.getState()

    setLoading(true)
    expect(userStoreSelectors.isLoading(useUserStore.getState())).toBe(true)

    setError('boom')
    expect(userStoreSelectors.error(useUserStore.getState())).toBe('boom')
    expect(userStoreSelectors.isLoading(useUserStore.getState())).toBe(false)
  })

  it('reset returns to initial state', () => {
    const { setUser, setLoading, setError, reset } = useUserStore.getState()
    setUser({ id: 'u2' } as any)
    setLoading(true)
    setError('oops')

    reset()
    const state = useUserStore.getState()
    expect(state.user).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})

