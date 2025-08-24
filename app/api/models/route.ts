import {
  getAllModels,
  getModelsForUserProviders,
  getModelsWithAccessFlags,
  getModelsWithAccessForProviders,
  refreshModelsCache,
} from "@/lib/models"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getProvidersWithEnvKeys } from "@/lib/user-keys"

export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      const allModels = await getAllModels()
      const models = allModels.map((model) => ({
        ...model,
        accessible: true,
      }))
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      // Guest: expose access based on env-provided credentials
      const envProviders = getProvidersWithEnvKeys()
      const models =
        envProviders.length > 0
          ? await getModelsWithAccessForProviders(envProviders)
          : await getModelsWithAccessFlags()
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const { data, error } = await supabase
      .from("user_keys")
      .select("provider")
      .eq("user_id", authData.user.id)

    if (error) {
      console.error("Error fetching user keys:", error)
      const models = await getModelsWithAccessFlags()
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const userProviders = data?.map((k) => k.provider) || []

    if (userProviders.length === 0) {
      // No user keys: fall back to env credentials if present
      const envProviders = getProvidersWithEnvKeys()
      const models =
        envProviders.length > 0
          ? await getModelsWithAccessForProviders(envProviders)
          : await getModelsWithAccessFlags()
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const models = await getModelsForUserProviders(userProviders)

    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error fetching models:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch models" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

export async function POST() {
  try {
    refreshModelsCache()
    const models = await getAllModels()

    return NextResponse.json({
      message: "Models cache refreshed",
      models,
      timestamp: new Date().toISOString(),
      count: models.length,
    })
  } catch (error) {
    console.error("Failed to refresh models:", error)
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    )
  }
}
