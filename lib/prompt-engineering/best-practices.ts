/**
 * OpenAI Best Practices for Prompt Engineering
 * Based on: https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api
 */

interface PromptConfig {
  systemPrompt?: string
  userMessage: string
  context?: string[]
  examples?: Array<{ input: string; output: string }>
  temperature?: number
  maxOutputTokens?: number
}

/**
 * Best Practice 1: Write clear instructions
 * Be specific about what you want the model to do
 */
export function createClearInstruction(task: string, details: string[]): string {
  const instructions = [
    `Task: ${task}`,
    'Requirements:',
    ...details.map((d, i) => `${i + 1}. ${d}`),
  ]
  return instructions.join('\n')
}

/**
 * Best Practice 2: Provide reference text
 * Include relevant context to ground the model's responses
 */
export function addReferenceContext(
  prompt: string,
  references: string[]
): string {
  if (references.length === 0) return prompt
  
  return `${prompt}

Reference Information:
${references.map((ref, i) => `[${i + 1}] ${ref}`).join('\n')}

Use the above references to inform your response.`
}

/**
 * Best Practice 3: Split complex tasks into simpler subtasks
 * Use chain-of-thought prompting for complex reasoning
 */
export function createChainOfThought(task: string, steps: string[]): string {
  return `${task}

Let's approach this step-by-step:
${steps.map((step, i) => `Step ${i + 1}: ${step}`).join('\n')}

Please work through each step carefully and show your reasoning.`
}

/**
 * Best Practice 4: Give the model time to think
 * Ask for reasoning before the final answer
 */
export function addReasoningRequest(prompt: string): string {
  return `${prompt}

Before providing your final answer, please:
1. Analyze the requirements
2. Consider potential approaches
3. Evaluate trade-offs
4. Explain your reasoning

Then provide your solution.`
}

/**
 * Best Practice 5: Use external tools
 * Leverage function calling for accurate computations and data retrieval
 */
export function createToolPrompt(
  task: string,
  availableTools: string[]
): string {
  return `${task}

You have access to the following tools:
${availableTools.map(tool => `- ${tool}`).join('\n')}

Use these tools when needed for accurate information or calculations.`
}

/**
 * Best Practice 6: Test changes systematically
 * Create evaluation criteria for prompt improvements
 */
export interface EvaluationCriteria {
  accuracy: boolean
  relevance: boolean
  completeness: boolean
  clarity: boolean
  safety: boolean
}

export function evaluateResponse(
  response: string,
  criteria: Partial<EvaluationCriteria>
): Record<string, boolean> {
  const results: Record<string, boolean> = {}
  
  if (criteria.accuracy !== undefined) {
    results.accuracy = criteria.accuracy
  }
  if (criteria.relevance !== undefined) {
    results.relevance = criteria.relevance
  }
  if (criteria.completeness !== undefined) {
    results.completeness = criteria.completeness
  }
  if (criteria.clarity !== undefined) {
    results.clarity = criteria.clarity
  }
  if (criteria.safety !== undefined) {
    results.safety = criteria.safety
  }
  
  return results
}

/**
 * Apply delimiters to clearly indicate distinct parts of the input
 */
export function addDelimiters(
  sections: Array<{ label: string; content: string }>
): string {
  return sections
    .map(({ label, content }) => {
      return `### ${label} ###
${content}
### End ${label} ###`
    })
    .join('\n\n')
}

/**
 * Specify the desired output format
 */
export function specifyOutputFormat(
  prompt: string,
  format: 'json' | 'markdown' | 'list' | 'code' | 'structured'
): string {
  const formatInstructions = {
    json: 'Provide your response as valid JSON.',
    markdown: 'Format your response using Markdown with appropriate headers and formatting.',
    list: 'Provide your response as a numbered or bulleted list.',
    code: 'Include code examples with proper syntax highlighting and comments.',
    structured: 'Structure your response with clear sections and subsections.',
  }
  
  return `${prompt}

Output Format: ${formatInstructions[format]}`
}

/**
 * Use few-shot examples to guide the model
 */
export function addFewShotExamples(
  prompt: string,
  examples: Array<{ input: string; output: string }>
): string {
  if (examples.length === 0) return prompt
  
  const exampleText = examples
    .map((ex, i) => {
      return `Example ${i + 1}:
Input: ${ex.input}
Output: ${ex.output}`
    })
    .join('\n\n')
  
  return `${prompt}

Here are some examples:

${exampleText}

Now, based on these examples, please process the following:`
}

/**
 * Create an optimized prompt following all best practices
 */
export function createOptimizedPrompt(config: PromptConfig): string {
  let prompt = config.userMessage
  
  // Add context if provided
  if (config.context && config.context.length > 0) {
    prompt = addReferenceContext(prompt, config.context)
  }
  
  // Add examples if provided
  if (config.examples && config.examples.length > 0) {
    prompt = addFewShotExamples(prompt, config.examples)
  }
  
  // Add reasoning request for complex tasks
  if (prompt.length > 200 || prompt.includes('analyze') || prompt.includes('evaluate')) {
    prompt = addReasoningRequest(prompt)
  }
  
  return prompt
}

/**
 * Optional security-focused prompt enhancement
 */
export function addSecurityContext(prompt: string): string {
  return `${prompt}

Security Considerations:
- Ensure all recommendations follow security best practices
- Consider potential vulnerabilities and attack vectors
- Include proper input validation and sanitization
- Implement appropriate access controls and authentication
- Follow the principle of least privilege
- Include audit logging where appropriate`
}

/**
 * Add role-specific context for better responses
 */
export function addRoleContext(
  prompt: string,
  role: 'developer' | 'security-engineer' | 'architect' | 'devops'
): string {
  const roleContexts = {
    developer: 'Provide practical, implementable code with clear comments and error handling.',
    'security-engineer': 'Focus on security implications, threat modeling, and defensive measures.',
    architect: 'Consider system design, scalability, maintainability, and architectural patterns.',
    devops: 'Include deployment considerations, monitoring, CI/CD, and infrastructure as code.',
  }
  
  return `${prompt}

Target Audience: ${role}
${roleContexts[role]}`
}

/**
 * Temperature settings based on task type
 */
export function getOptimalTemperature(
  taskType: 'creative' | 'analytical' | 'code' | 'factual'
): number {
  const temperatures = {
    creative: 0.8,
    analytical: 0.3,
    code: 0.2,
    factual: 0.1,
  }
  
  return temperatures[taskType]
}

/**
 * Create a system prompt optimized for a security-focused assistant
 */
export function createSecuritySystemPrompt(): string {
  return `You are a security-focused AI assistant specializing in:
- Secure code development and review
- Threat modeling and risk assessment
- Security architecture and design patterns
- Vulnerability analysis and mitigation
- Compliance and regulatory requirements
- DevSecOps best practices

Guidelines:
1. Always prioritize security in your recommendations
2. Provide specific, actionable security measures
3. Include code examples with security best practices
4. Explain potential vulnerabilities and their impacts
5. Reference industry standards (OWASP, NIST, etc.) when relevant
6. Consider both technical and business security requirements

Response Style:
- Be precise and technical when discussing security concepts
- Provide clear explanations with examples
- Include references to security frameworks and standards
- Suggest tools and libraries that enhance security
- Always validate and sanitize inputs in code examples`
}