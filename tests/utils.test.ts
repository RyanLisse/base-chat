import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Dynamic import to ensure fresh env for isDev tests
let utils: typeof import('@/lib/utils')

describe('lib/utils', () => {
  beforeEach(async () => {
    // Reset module cache to re-evaluate isDev based on env
    vi.resetModules()
    utils = await import('@/lib/utils')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cn merges class names and de-dupes', () => {
    const { cn } = utils
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold')
    expect(cn('bg-red-500', 'bg-red-600')).toBe('bg-red-600')
    expect(cn('mt-2', undefined, null, 'mt-4')).toBe('mt-4')
  })

  it('formatNumber formats with commas', () => {
    const { formatNumber } = utils
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1000)).toBe('1,000')
    expect(formatNumber(9876543)).toBe('9,876,543')
  })

  it('debounce delays calls and executes the last invocation', () => {
    vi.useFakeTimers()
    const { debounce } = utils
    const spy = vi.fn()
    const debounced = debounce(spy, 200)

    debounced('a')
    vi.advanceTimersByTime(100)
    debounced('b')
    vi.advanceTimersByTime(199)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('b')
  })

  it('isDev reflects NODE_ENV', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'development'
    let m = await import('@/lib/utils')
    expect(m.isDev).toBe(true)

    vi.resetModules()
    process.env.NODE_ENV = 'production'
    m = await import('@/lib/utils')
    expect(m.isDev).toBe(false)
  })
})

