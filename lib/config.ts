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

export const APP_NAME = "Base Chat"
export const APP_DOMAIN = "https://your-app-domain.com"

export const SUGGESTIONS = [
  {
    label: "Brainstorm",
    highlight: "Brainstorm",
    prompt: `Brainstorm`,
    items: [
      "Brainstorm ideas for a weekend project",
      "Brainstorm marketing angles for a new product",
      "Brainstorm ways to improve team collaboration",
      "Brainstorm names for a newsletter or app",
    ],
    icon: Sparkle,
  },
  {
    label: "Write",
    highlight: "Write",
    prompt: `Write`,
    items: [
      "Write a friendly email to a client about a project update",
      "Write a concise bio for my profile",
      "Write a blog post outline on a topic I choose",
      "Write social captions in different tones (formal, playful, witty)",
    ],
    icon: Notepad,
  },
  {
    label: "Summarize",
    highlight: "Summarize",
    prompt: `Summarize`,
    items: [
      "Summarize an article into key bullet points",
      "Summarize a long email thread with action items",
      "Summarize a meeting transcript with decisions and owners",
      "Summarize this text at beginner, intermediate, and expert levels",
    ],
    icon: BookOpenText,
  },
  {
    label: "Explain",
    highlight: "Explain",
    prompt: `Explain`,
    items: [
      "Explain this concept to me like I'm new to it",
      "Explain pros and cons of two options I provide",
      "Explain how to get started learning a topic with a plan",
      "Explain trade-offs and recommend a choice based on my goals",
    ],
    icon: Lightbulb,
  },
  {
    label: "Improve",
    highlight: "Improve",
    prompt: `Improve`,
    items: [
      "Improve this paragraph for clarity and tone",
      "Improve grammar and make this text more concise",
      "Improve and adapt this email for a different audience",
      "Improve structure: rewrite with headings and bullet points",
    ],
    icon: PaintBrush,
  },
  {
    label: "Code",
    highlight: "Code",
    prompt: `Code`,
    items: [
      "Code a small utility function from my description",
      "Code review this snippet and suggest improvements",
      "Code a test for this function using my framework",
      "Code: explain this error and how to fix it",
    ],
    icon: Code,
  },
]

export const BASE_SYSTEM_PROMPT = `You are a helpful, knowledgeable AI assistant.

- Communicate clearly and concisely
- Ask clarifying questions when requirements are ambiguous
- Provide step-by-step guidance and practical examples
- When coding, favor readable, maintainable solutions with error handling
- Cite assumptions explicitly; call out risks and edge cases
- Default to safe behavior: avoid sharing secrets, respect privacy, and sanitize inputs

If asked to perform specialized tasks (writing, brainstorming, explaining, coding, analysis), adapt tone and structure to match the task and the user's expertise level.`

export const SYSTEM_PROMPT_DEFAULT = BASE_SYSTEM_PROMPT

// When file search is enabled, guide the model to (a) ground
// answers in retrieved documents and (b) include light-weight citations.
// The UI renders a Sources panel and also tolerates inline [1], [2] markers.
export const FILE_SEARCH_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

When you use file search or retrieved context:
- Only answer using grounded information from the retrieved files.
- Insert inline citations like [1], [2] immediately after the relevant sentence.
- Each [n] should correspond to an item in the Sources panel, ordered by relevance.
- If you are unsure or the information is not present, say so rather than guessing.`

export const MESSAGE_MAX_LENGTH = 10000
