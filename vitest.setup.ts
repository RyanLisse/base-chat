// Global test setup for Vitest
import '@testing-library/jest-dom'

// Ensure a stable NODE_ENV default for tests
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

// Mock window.matchMedia for components that might query it
if (typeof window !== 'undefined' && !window.matchMedia) {
  // @ts-expect-error - augmenting jsdom window
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

