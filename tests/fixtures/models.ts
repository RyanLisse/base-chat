export const mockModels = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    description: 'Most capable GPT-4 model',
    context_length: 8192,
    max_output_tokens: 4096,
    pricing: {
      input: 0.00003,
      output: 0.00006,
    },
    features: ['text', 'vision'],
    requires_auth: false,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Faster, cheaper GPT-4',
    context_length: 128000,
    max_output_tokens: 4096,
    pricing: {
      input: 0.00001,
      output: 0.00003,
    },
    features: ['text', 'vision'],
    requires_auth: false,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Latest Claude model with enhanced capabilities',
    context_length: 200000,
    max_output_tokens: 8192,
    pricing: {
      input: 0.000003,
      output: 0.000015,
    },
    features: ['text', 'vision', 'tools'],
    requires_auth: false,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Premium model requiring authentication',
    context_length: 128000,
    max_output_tokens: 4096,
    pricing: {
      input: 0.000005,
      output: 0.000015,
    },
    features: ['text', 'vision', 'audio'],
    requires_auth: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    description: 'Google\'s advanced multimodal model',
    context_length: 2000000,
    max_output_tokens: 8192,
    pricing: {
      input: 0.000003,
      output: 0.000015,
    },
    features: ['text', 'vision', 'audio', 'video'],
    requires_auth: false,
  },
]

export const mockProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o'],
    api_key_required: true,
    status: 'active',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-3-5-sonnet-20241022'],
    api_key_required: true,
    status: 'active',
  },
  {
    id: 'google',
    name: 'Google',
    models: ['gemini-1.5-pro'],
    api_key_required: true,
    status: 'active',
  },
]

export const mockUserFavoriteModels = [
  'claude-3-5-sonnet-20241022',
  'gpt-4-turbo',
]

export const mockModelUsageStats = {
  'gpt-4': {
    total_requests: 150,
    total_tokens: 45000,
    avg_response_time: 2.5,
    success_rate: 0.98,
  },
  'claude-3-5-sonnet-20241022': {
    total_requests: 200,
    total_tokens: 60000,
    avg_response_time: 1.8,
    success_rate: 0.99,
  },
}