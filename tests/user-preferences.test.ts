import { describe, expect, it } from 'vitest'
import {
  convertFromApiFormat,
  convertToApiFormat,
  defaultPreferences,
  type UserPreferences,
} from '@/lib/user-preference-store/utils'

describe('user-preference-store/utils', () => {
  it('convertFromApiFormat maps snake_case to camelCase with defaults', () => {
    const api = {
      layout: 'sidebar',
      prompt_suggestions: false,
      show_tool_invocations: false,
      show_conversation_previews: false,
      multi_model_enabled: true,
      hidden_models: ['gpt-3.5'],
    }

    const prefs = convertFromApiFormat(api)
    expect(prefs).toEqual<UserPreferences>({
      layout: 'sidebar',
      promptSuggestions: false,
      showToolInvocations: false,
      showConversationPreviews: false,
      multiModelEnabled: true,
      hiddenModels: ['gpt-3.5'],
    })
  })

  it('convertFromApiFormat uses defaults when fields missing', () => {
    const prefs = convertFromApiFormat({})
    expect(prefs).toEqual(defaultPreferences)
  })

  it('convertToApiFormat maps only provided keys to snake_case', () => {
    const api = convertToApiFormat({
      layout: 'fullscreen',
      promptSuggestions: false,
      showConversationPreviews: true,
    })

    expect(api).toEqual({
      layout: 'fullscreen',
      prompt_suggestions: false,
      show_conversation_previews: true,
    })
  })
})

