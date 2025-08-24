import type { Message as MessageAISDK } from "@ai-sdk/react"

// Lightweight normalized shape used by the UI Sources list
type NormalizedSource = {
  id: string
  title?: string
  url?: string
}

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export function getSources(parts: MessageAISDK["parts"]) {
  if (!Array.isArray(parts) || parts.length === 0) return [] as NormalizedSource[]

  const collected: NormalizedSource[] = []

  for (const part of parts) {
    // 1) Direct source parts emitted by the model/provider
    if ((part as any).type === "source" && (part as any).source) {
      const s = (part as any).source
      if (s && typeof s === "object" && s.id) {
        collected.push({ id: String(s.id), title: s.title, url: s.url })
      }
      continue
    }

    // 2) Tool invocation results that may contain sources
    if ((part as any).type === "tool-invocation" && (part as any).toolInvocation?.state === "result") {
      const { toolName, result } = (part as any).toolInvocation

      // 2a) Pattern produced by a "summarizeSources" style tool
      //     that returns an array with a "citations" field
      if (
        toolName === "summarizeSources" &&
        result?.result?.[0]?.citations
      ) {
        try {
          const citations = result.result.flatMap((item: { citations?: any[] }) => item.citations || [])
          for (const c of citations) {
            if (c && typeof c === "object") {
              collected.push({ id: String(c.id || c.url || genId()), title: c.title, url: c.url })
            }
          }
        } catch (_) {
          // ignore malformed data
        }
        continue
      }

      // 2b) Generic array results that already look like sources
      //     e.g. [{ url, title, ... }]
      if (Array.isArray(result)) {
        for (const item of result) {
          if (item && typeof item === "object" && ("url" in item || "title" in item || "id" in item)) {
            collected.push({ id: String(item.id || item.url || genId()), title: item.title, url: item.url })
          }
        }
        continue
      }

      // 2c) fileSearch tool result from our OpenAI Vector Store integration
      //     Shape: { results: [{ file_id, file_name, metadata? }], ... }
      if (toolName === "fileSearch" && result && typeof result === "object" && Array.isArray(result.results)) {
        for (const r of result.results) {
          if (!r) continue
          const id = String(r.file_id || r.id || genId())
          const title = r.file_name || r.title || `Document ${id.slice(0, 6)}`
          // If vector store item has a captured source URL in metadata, surface it. Optional.
          const url = r.metadata?.url || r.url || undefined
          collected.push({ id, title, url })
        }
        continue
      }

      // 2d) Tools that return a { content: [...] } payload with embedded source parts
      if (result && typeof result === "object" && Array.isArray(result.content)) {
        for (const c of result.content) {
          if (c && typeof c === "object" && c.type === "source" && c.source?.id) {
            collected.push({ id: String(c.source.id), title: c.source.title, url: c.source.url })
          }
        }
        continue
      }
    }
  }

  // De-duplicate by id then by url
  const byId = new Map<string, NormalizedSource>()
  for (const s of collected) {
    if (!byId.has(s.id)) byId.set(s.id, s)
  }

  const unique = Array.from(byId.values())
  return unique
}
