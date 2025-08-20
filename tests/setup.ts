import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock MSW server for API requests
export const server = setupServer(
  // Chat API mock
  http.post('/api/chat', () => {
    return HttpResponse.text('data: {"type":"text","value":"Mocked AI response"}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }),
  
  // User preferences mock
  http.get('/api/user-preferences', () => {
    return HttpResponse.json({ favorites: [], preferences: {} })
  }),
  
  // Models API mock
  http.get('/api/models', () => {
    return HttpResponse.json([
      { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' }
    ])
  }),
  
  // Health check mock
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' })
  })
)

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

// Clean up after each test case
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// Close server after all tests
afterAll(() => {
  server.close()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => ({ data: null, error: null })),
    })),
    auth: {
      getUser: vi.fn(() => ({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(() => ({ data: null, error: null })),
      signOut: vi.fn(() => ({ error: null })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => ({ data: { path: 'mock-path' }, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'mock-url' } })),
      })),
    },
  }),
}))

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false,
    error: null,
  })),
  QueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock API utilities
vi.mock('@/lib/api', () => ({
  getOrCreateGuestUserId: vi.fn(),
  UsageLimitError: class extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'UsageLimitError'
    }
  },
}))