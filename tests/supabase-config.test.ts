import { describe, expect, it, vi } from 'vitest'

describe('lib/supabase/config', () => {
  it('isSupabaseEnabled is true when both env vars present', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    vi.resetModules()
    const { isSupabaseEnabled } = await import('../../lib/supabase/config')
    expect(isSupabaseEnabled).toBe(true)
  })

  it('isSupabaseEnabled is false when missing vars', async () => {
    vi.unstubAllEnvs()
    vi.resetModules()
    const { isSupabaseEnabled } = await import('../../lib/supabase/config')
    expect(isSupabaseEnabled).toBe(false)
  })
})

