import { PROVIDERS } from "@/lib/providers"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getProvidersWithEnvKeys } from "@/lib/user-keys"

const SUPPORTED_PROVIDERS = PROVIDERS.map((p) => p.id)

export async function GET() {
  try {
    const supabase = await createClient()
    // Build baseline from env keys so guests can see available providers
    const envProviders = new Set(getProvidersWithEnvKeys())

    if (!supabase) {
      const providerStatus = SUPPORTED_PROVIDERS.reduce(
        (acc, provider) => {
          acc[provider] = envProviders.has(provider as string)
          return acc
        },
        {} as Record<string, boolean>
      )
      return NextResponse.json(providerStatus)
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      const providerStatus = SUPPORTED_PROVIDERS.reduce(
        (acc, provider) => {
          acc[provider] = envProviders.has(provider as string)
          return acc
        },
        {} as Record<string, boolean>
      )
      return NextResponse.json(providerStatus)
    }

    const { data, error } = await supabase
      .from("user_keys")
      .select("provider")
      .eq("user_id", authData.user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create status object for all supported providers (union of user + env)
    const userProviders = new Set((data?.map((k) => k.provider) || []) as string[])
    const providerStatus = SUPPORTED_PROVIDERS.reduce((acc, provider) => {
      acc[provider] = userProviders.has(provider) || envProviders.has(provider)
      return acc
    }, {} as Record<string, boolean>)

    return NextResponse.json(providerStatus)
  } catch (err) {
    console.error("Key status error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
