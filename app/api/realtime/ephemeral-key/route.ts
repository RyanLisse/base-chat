import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

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

    // For now, we'll use a mock key since we need to decrypt the actual key
    // In production, you'd decrypt the key using the encryption service
    const mockApiKey = 'sk-mock-' + Buffer.from(user.id).toString('base64')
    
    // Initialize OpenAI client with mock key
    const openai = new OpenAI({
      apiKey: mockApiKey,
    })

    // For now, create a mock ephemeral key since the realtime sessions API is not available yet
    // In production, you would create an actual ephemeral key using OpenAI's realtime API
    const mockEphemeralKey = {
      client_secret: {
        value: `ek_live_${Buffer.from(user.id + Date.now()).toString('base64')}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      },
      id: `session_${user.id}_${Date.now()}`
    }

    logger.info('Mock ephemeral key created successfully')

    return NextResponse.json({
      client_secret: {
        value: mockEphemeralKey.client_secret.value,
        expires_at: mockEphemeralKey.client_secret.expires_at,
      },
      session_id: mockEphemeralKey.id,
    })

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