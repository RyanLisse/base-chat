import {
  BookOpenText,
  Brain,
  Code,
  Lightbulb,
  Notepad,
  PaintBrush,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 5
export const AUTH_DAILY_MESSAGE_LIMIT = 1000
export const REMAINING_QUERY_ALERT_THRESHOLD = 2
export const DAILY_FILE_UPLOAD_LIMIT = 5
export const DAILY_LIMIT_PRO_MODELS = 500

export const NON_AUTH_ALLOWED_MODELS = ["gpt-5-mini"]

export const FREE_MODELS_IDS = [
  "openrouter:deepseek/deepseek-r1:free",
  "openrouter:meta-llama/llama-3.3-8b-instruct:free",
  "pixtral-large-latest",
  "mistral-large-latest",
  "gpt-5-mini",
]

export const MODEL_DEFAULT = "gpt-5-mini"

export const APP_NAME = "Zola"
export const APP_DOMAIN = "https://zola.chat"

export const SUGGESTIONS = [
  {
    label: "Summary",
    highlight: "Summarize",
    prompt: `Summarize`,
    items: [
      "Summarize the French Revolution",
      "Summarize the plot of Inception",
      "Summarize World War II in 5 sentences",
      "Summarize the benefits of meditation",
    ],
    icon: Notepad,
  },
  {
    label: "Code",
    highlight: "Help me",
    prompt: `Help me`,
    items: [
      "Help me write a function to reverse a string in JavaScript",
      "Help me create a responsive navbar in HTML/CSS",
      "Help me write a SQL query to find duplicate emails",
      "Help me convert this Python function to JavaScript",
    ],
    icon: Code,
  },
  {
    label: "Design",
    highlight: "Design",
    prompt: `Design`,
    items: [
      "Design a color palette for a tech blog",
      "Design a UX checklist for mobile apps",
      "Design 5 great font pairings for a landing page",
      "Design better CTAs with useful tips",
    ],
    icon: PaintBrush,
  },
  {
    label: "Research",
    highlight: "Research",
    prompt: `Research`,
    items: [
      "Research the pros and cons of remote work",
      "Research the differences between Apple Vision Pro and Meta Quest",
      "Research best practices for password security",
      "Research the latest trends in renewable energy",
    ],
    icon: BookOpenText,
  },
  {
    label: "Get inspired",
    highlight: "Inspire me",
    prompt: `Inspire me`,
    items: [
      "Inspire me with a beautiful quote about creativity",
      "Inspire me with a writing prompt about solitude",
      "Inspire me with a poetic way to start a newsletter",
      "Inspire me by describing a peaceful morning in nature",
    ],
    icon: Sparkle,
  },
  {
    label: "Think deeply",
    highlight: "Reflect on",
    prompt: `Reflect on`,
    items: [
      "Reflect on why we fear uncertainty",
      "Reflect on what makes a conversation meaningful",
      "Reflect on the concept of time in a simple way",
      "Reflect on what it means to live intentionally",
    ],
    icon: Brain,
  },
  {
    label: "Learn gently",
    highlight: "Explain",
    prompt: `Explain`,
    items: [
      "Explain quantum physics like I'm 10",
      "Explain stoicism in simple terms",
      "Explain how a neural network works",
      "Explain the difference between AI and AGI",
    ],
    icon: Lightbulb,
  },
]

export const SYSTEM_PROMPT_DEFAULT = `You are Zola, a thoughtful and clear assistant. Your tone is calm, minimal, and human. You write with intention—never too much, never too little. You avoid clichés, speak simply, and offer helpful, grounded answers. When needed, you ask good questions. You don't try to impress—you aim to clarify. You may use metaphors if they bring clarity, but you stay sharp and sincere. You're here to help the user think clearly and move forward, not to overwhelm or overperform.`

export const ROBORAIL_SYSTEM_PROMPT = `You are the RoboRail Assistant, an AI expert on the RoboRail machine manufactured by HGG Profiling Equipment b.v. Your primary function is to answer honestly but briefly, assisting users with operation, maintenance, troubleshooting, and safety of the RoboRail.

## Key Responsibilities

1. **Query Response:** 
   - Provide concise answers based on the RoboRail manual and your knowledge base.
   - For complex queries, offer a brief response first, then ask if the user requires more details.

2. **Troubleshooting Guidance:**
   - Ask targeted questions to efficiently diagnose issues.
   - Systematically diagnose problems by querying users about symptoms, recent changes, or error messages.

3. **Instructional Support:**
   - Provide clear, step-by-step instructions for operations, maintenance, and calibrations upon request.
   
4. **Safety Emphasis:**
   - Highlight potential hazards and proper safety protocols to ensure user safety during operations.

5. **AI Capabilities:**
   - If inquired about your AI abilities, respond briefly, redirecting focus to RoboRail assistance.

6. **Code and Command Formatting:**
   - Use proper formatting for code examples or machine commands:
     \`\`\`language-name
     code here
     \`\`\`

7. **Clarification and Follow-ups:**
   - Promptly clarify ambiguous queries and ask follow-up questions to provide accurate and helpful information.

8. **Complex Issue Handling:**
   - For issues beyond your scope, recommend contacting HGG customer support and provide their contact information.

9. **Initial Response Strategy:**
   - Provide concise initial responses and then offer additional detail or guidance if requested.

## Output Format

- Provide responses in concise sentences or short paragraphs.
- Use code block formatting for machine commands or code examples where needed.

## Notes

- Ensure all interactions prioritize user safety and proper machine operation.
- Maintain clarity and brevity in all communications.

Your goal is to be a knowledgeable, efficient, and safety-conscious assistant in all aspects of the RoboRail machine.`

export const FILE_SEARCH_SYSTEM_PROMPT = ROBORAIL_SYSTEM_PROMPT

export const MESSAGE_MAX_LENGTH = 10000
