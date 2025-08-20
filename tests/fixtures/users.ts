export const mockGuestUser = null

export const mockAuthenticatedUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_metadata: {
    full_name: 'Test User',
  },
  app_metadata: {},
}

export const mockPremiumUser = {
  id: 'premium-user-123',
  email: 'premium@example.com',
  name: 'Premium User',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_metadata: {
    full_name: 'Premium User',
    subscription_tier: 'premium',
  },
  app_metadata: {
    subscription: 'premium',
  },
}

export const mockUserWithApiKeys = {
  id: 'user-with-keys-123',
  email: 'apiuser@example.com',
  name: 'API User',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_metadata: {
    full_name: 'API User',
  },
  app_metadata: {},
  api_keys: {
    openai: 'sk-test-openai-key',
    anthropic: 'sk-ant-test-key',
  },
}

export const mockUsageData = {
  daily_usage: {
    '2024-01-01': {
      total_requests: 5,
      total_tokens: 1500,
      models: {
        'gpt-4': { requests: 3, tokens: 1000 },
        'claude-3-5-sonnet-20241022': { requests: 2, tokens: 500 },
      },
    },
  },
  monthly_usage: {
    '2024-01': {
      total_requests: 150,
      total_tokens: 45000,
    },
  },
}