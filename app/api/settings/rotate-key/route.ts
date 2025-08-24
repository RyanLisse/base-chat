import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  decryptApiKey,
  encryptApiKey,
  generateApiKey,
  validateApiKeyFormat 
} from '@/lib/security/encryption'
import { rateLimit, logSecurityEvent } from '@/lib/security/middleware'

// POST: Rotate an API key
export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(req, 'api_key_operations')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await req.json()
    const { provider, newApiKey, autoGenerate = false } = body

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      )
    }

    if (!autoGenerate && !newApiKey) {
      return NextResponse.json(
        { error: 'New API key is required or set autoGenerate to true' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get the current key
    const { data: currentKey, error: fetchError } = await supabase
      .from('user_keys')
      .select('encrypted_key, iv, auth_tag')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (fetchError || !currentKey) {
      return NextResponse.json(
        { error: 'No existing API key found for rotation' },
        { status: 404 }
      )
    }

    // Prepare the new key
    let finalNewKey = newApiKey
    if (autoGenerate) {
      // Generate a new key (useful for internal APIs)
      const prefix = provider === 'internal' ? 'rr' : 'sk'
      finalNewKey = generateApiKey(prefix)
    }

    // Validate new key format
    if (!validateApiKeyFormat(finalNewKey, provider)) {
      return NextResponse.json(
        { error: `Invalid API key format for ${provider}` },
        { status: 400 }
      )
    }

    // Encrypt the new key
    const { encrypted, iv, authTag, masked } = encryptApiKey(finalNewKey, user.id)

    // Start a transaction-like operation
    const timestamp = new Date().toISOString()

    // Backup the old key (store in audit log with encrypted value)
    await logSecurityEvent(supabase, user.id, 'key_rotation_backup', {
      provider,
      old_encrypted: currentKey.encrypted_key,
      old_iv: currentKey.iv,
      old_auth_tag: currentKey.auth_tag,
      rotation_timestamp: timestamp
    })

    // Update with the new encrypted key
    const { error: updateError } = await supabase
      .from('user_keys')
      .update({
        encrypted_key: encrypted,
        iv,
        auth_tag: authTag,
        masked_key: masked,
        last_rotated: timestamp,
        updated_at: timestamp
      })
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (updateError) {
      // Try to restore if update fails
      console.error('Failed to rotate API key:', updateError)
      
      await logSecurityEvent(supabase, user.id, 'key_rotation_failed', {
        provider,
        error: updateError.message
      })

      return NextResponse.json(
        { error: 'Failed to rotate API key' },
        { status: 500 }
      )
    }

    // Log successful rotation
    await logSecurityEvent(supabase, user.id, 'key_rotated', {
      provider,
      masked_key: masked,
      auto_generated: autoGenerate
    })

    // Return the new key only if auto-generated
    const response: any = {
      success: true,
      message: 'API key rotated successfully',
      masked_key: masked
    }

    if (autoGenerate) {
      response.new_key = finalNewKey
      response.warning = 'Save this key securely. It will not be shown again.'
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in POST /api/settings/rotate-key:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: Check if key needs rotation
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get('provider')

  if (!provider) {
    return NextResponse.json(
      { error: 'Provider is required' },
      { status: 400 }
    )
  }

  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get the key's last rotation date
    const { data: keyData, error: fetchError } = await supabase
      .from('user_keys')
      .select('last_rotated, created_at')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (fetchError || !keyData) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      )
    }

    // Get user's security settings for rotation policy
    const { data: securitySettings } = await supabase
      .from('user_security_settings')
      .select('config')
      .eq('user_id', user.id)
      .single()

    const rotationConfig = (securitySettings?.config as any) || {}
    const requireRotation = rotationConfig?.requireApiKeyRotation ?? false
    const rotationDays = rotationConfig?.rotationDays ?? 90

    // Calculate if rotation is needed
    const lastRotated = new Date(keyData.last_rotated || keyData.created_at || Date.now())
    const daysSinceRotation = Math.floor(
      (Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24)
    )

    const needsRotation = requireRotation && daysSinceRotation >= rotationDays
    const recommendedRotation = daysSinceRotation >= 180 // Recommend after 6 months

    return NextResponse.json({
      needsRotation,
      recommendedRotation,
      daysSinceRotation,
      rotationPolicy: {
        enabled: requireRotation,
        days: rotationDays
      }
    })
  } catch (error) {
    console.error('Error in GET /api/settings/rotate-key:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}