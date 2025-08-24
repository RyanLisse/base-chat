import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { decryptKey } from '@/lib/encryption'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.warn('Unauthorized realtime key request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's OpenAI API key
    const { data: keyData, error: keyError } = await supabase
      .from('user_keys')
      .select('encrypted_key, iv, auth_tag')
      .eq('user_id', user.id)
      .eq('provider', 'openai')
      .single()

    if (keyError || !keyData?.encrypted_key) {
      logger.warn('No OpenAI API key found for user')
      return NextResponse.json(
        { error: 'OpenAI API key not found. Please add your API key in settings.' },
        { status: 400 }
      )
    }

    // Decrypt the user's API key
    let decryptedApiKey: string
    try {
      const encryptedWithTag = `${keyData.encrypted_key}:${keyData.auth_tag}`
      decryptedApiKey = decryptKey(encryptedWithTag, keyData.iv)
    } catch (decryptError) {
      logger.error('Failed to decrypt API key:', decryptError)
      return NextResponse.json(
        { error: 'Failed to decrypt API key. Please re-add your API key in settings.' },
        { status: 500 }
      )
    }
    
    // Initialize OpenAI client with decrypted key
    const openai = new OpenAI({
      apiKey: decryptedApiKey,
    })

    // Create an ephemeral key using OpenAI's realtime API
    try {
      const ephemeralKey = await openai.beta.realtime.sessions.create({
        model: 'gpt-4o-realtime-preview-2024-10-01',
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful assistant that provides transcription services.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        }
      })

      logger.info('Ephemeral key created successfully')

      return NextResponse.json({
        client_secret: {
          value: ephemeralKey.client_secret.value,
          expires_at: ephemeralKey.client_secret.expires_at,
        },
        session_id: ephemeralKey.id,
      })
    } catch (realtimeError) {
      logger.error('Failed to create ephemeral key:', realtimeError)
      
      // Fallback: Return error for now since OpenAI Realtime API might not be available
      return NextResponse.json(
        { 
          error: 'Realtime API not available. Please check your OpenAI API key has access to GPT-4o Realtime features.',
          details: realtimeError instanceof Error ? realtimeError.message : 'Unknown error'
        },
        { status: 503 }
      )
    }

  } catch (error) {
    logger.error('Error creating ephemeral key')

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { 
          error: 'OpenAI API error',
          details: error.message 
        },
        { status: error.status || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}