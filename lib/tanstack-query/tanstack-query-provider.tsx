"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { ReactNode, useState } from "react"
import { toast } from "@/components/ui/toast"

const STALE_TIME = 1000 * 60 * 5 // 5 minutes
const CACHE_TIME = 1000 * 60 * 10 // 10 minutes
const RETRY_DELAY = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000)

export function TanstackQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME,
            gcTime: CACHE_TIME,
            retry: 3,
            retryDelay: RETRY_DELAY,
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always',
            networkMode: 'offlineFirst',
          },
          mutations: {
            retry: 1,
            retryDelay: RETRY_DELAY,
            networkMode: 'offlineFirst',
            onError: (error) => {
              const message = error instanceof Error ? error.message : 'An error occurred'
              toast({ title: message, status: 'error' })
            },
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  )
}
