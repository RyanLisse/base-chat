import { vi } from 'vitest'

export const mockUseChat = {
  messages: [],
  input: '',
  handleInputChange: vi.fn(),
  handleSubmit: vi.fn(),
  setInput: vi.fn(),
  append: vi.fn(),
  reload: vi.fn(),
  stop: vi.fn(),
  isLoading: false,
  error: null,
  data: [],
  setData: vi.fn(),
}

export const mockStreamText = vi.fn(() => ({
  toDataStreamResponse: () => new Response('mocked response'),
  textStream: async function* () {
    yield 'Mocked AI response'
  },
  text: 'Mocked AI response',
}))

export const mockGenerateText = vi.fn(() => ({
  text: 'Mocked AI response',
  usage: { promptTokens: 10, completionTokens: 20 },
}))

// Mock AI SDK modules
vi.mock('ai', () => ({
  useChat: () => mockUseChat,
  streamText: mockStreamText,
  generateText: mockGenerateText,
  convertToCoreMessages: vi.fn((messages) => messages),
}))

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'openai'),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'anthropic'),
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'google'),
}))