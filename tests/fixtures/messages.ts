export const mockMessages = [
  {
    id: '1',
    role: 'user' as const,
    content: 'Hello, how are you?',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },
  {
    id: '2',
    role: 'assistant' as const,
    content: 'Hello! I am doing well, thank you for asking. How can I help you today?',
    createdAt: new Date('2024-01-01T00:01:00Z'),
  },
  {
    id: '3',
    role: 'user' as const,
    content: 'Can you help me write a function to calculate the factorial of a number?',
    createdAt: new Date('2024-01-01T00:02:00Z'),
  },
  {
    id: '4',
    role: 'assistant' as const,
    content: 'Certainly! Here is a recursive function to calculate the factorial:\n\n```javascript\nfunction factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}\n```',
    createdAt: new Date('2024-01-01T00:03:00Z'),
  },
]

export const mockChatWithFiles = {
  id: 'chat-with-files',
  messages: [
    {
      id: '1',
      role: 'user' as const,
      content: 'Please analyze this document',
      attachments: [
        {
          id: 'file-1',
          name: 'document.pdf',
          size: 1024000,
          type: 'application/pdf',
          url: 'mock://file-url',
        },
      ],
      createdAt: new Date('2024-01-01T00:00:00Z'),
    },
    {
      id: '2',
      role: 'assistant' as const,
      content: 'I have analyzed your document. Here are the key points...',
      createdAt: new Date('2024-01-01T00:01:00Z'),
    },
  ],
}

export const mockEmptyChat = {
  id: 'empty-chat',
  messages: [],
}

export const mockMultiTurnConversation = {
  id: 'multi-turn',
  messages: [
    {
      id: '1',
      role: 'user' as const,
      content: 'What is the capital of France?',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    },
    {
      id: '2',
      role: 'assistant' as const,
      content: 'The capital of France is Paris.',
      createdAt: new Date('2024-01-01T00:01:00Z'),
    },
    {
      id: '3',
      role: 'user' as const,
      content: 'What about the population?',
      createdAt: new Date('2024-01-01T00:02:00Z'),
    },
    {
      id: '4',
      role: 'assistant' as const,
      content: 'Paris has a population of approximately 2.2 million people within the city proper.',
      createdAt: new Date('2024-01-01T00:03:00Z'),
    },
    {
      id: '5',
      role: 'user' as const,
      content: 'Thank you!',
      createdAt: new Date('2024-01-01T00:04:00Z'),
    },
    {
      id: '6',
      role: 'assistant' as const,
      content: 'You\'re welcome! Feel free to ask if you have any other questions.',
      createdAt: new Date('2024-01-01T00:05:00Z'),
    },
  ],
}