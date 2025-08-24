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
      logger.warn('Unauthorized embeddings request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { texts } = await request.json()

    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json(
        { error: 'texts array is required' },
        { status: 400 }
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

    // Generate embeddings
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float'
      })

      return NextResponse.json({
        embeddings: response.data.map(item => item.embedding)
      })
    } catch (embeddingError) {
      logger.error('Failed to generate embeddings:', embeddingError)
      
      if (embeddingError instanceof OpenAI.APIError) {
        return NextResponse.json(
          { 
            error: 'OpenAI API error',
            details: embeddingError.message 
          },
          { status: embeddingError.status || 500 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to generate embeddings' },
        { status: 500 }
      )
    }

  } catch (error) {
    logger.error('Error in embeddings endpoint:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}