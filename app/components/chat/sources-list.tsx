"use client"

import { cn } from "@/lib/utils"
import type { SourceUIPart } from 'ai'
import { CaretDown, Link } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { useState } from "react"
import { addUTM, formatUrl, getFavicon } from "./utils"

type SourcesListProps = {
  sources: Array<Pick<SourceUIPart["source"], 'id' | 'title' | 'url'>>
  className?: string
}

const TRANSITION = {
  type: "spring",
  duration: 0.2,
  bounce: 0,
}

export function SourcesList({ sources, className }: SourcesListProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set())

  const handleFaviconError = (url: string) => {
    setFailedFavicons((prev) => new Set(prev).add(url))
  }

  return (
    <div className={cn("my-4", className)}>
      <div className="border-border flex flex-col gap-0 overflow-hidden rounded-md border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="hover:bg-accent flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors"
        >
          <div className="flex flex-1 flex-row items-center gap-2 text-left text-sm">
            Sources
            <div className="flex -space-x-1">
              {sources?.map((source, index) => {
                const faviconUrl = source.url ? getFavicon(source.url) : null
                const showFallback = !faviconUrl || (source.url ? failedFavicons.has(source.url) : true)

                return showFallback ? (
                  <div
                    key={`${source.url}-${index}`}
                    className="bg-muted border-background h-4 w-4 rounded-full border"
                  />
                ) : (
                  <Image
                    key={`${source.url}-${index}`}
                    src={faviconUrl}
                    alt={`Favicon for ${source.title}`}
                    width={16}
                    height={16}
                    className="border-background h-4 w-4 rounded-sm border"
                    onError={() => source.url && handleFaviconError(source.url)}
                  />
                )
              })}
              {sources.length > 3 && (
                <span className="text-muted-foreground ml-1 text-xs">
                  +{sources.length - 3}
                </span>
              )}
            </div>
          </div>
          <CaretDown
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded ? "rotate-180 transform" : ""
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSITION}
              className="overflow-hidden"
            >
              <ul className="space-y-2 px-3 pt-3 pb-3">
                {sources.map((source) => {
                  const faviconUrl = source.url ? getFavicon(source.url) : null
                  const showFallback = !faviconUrl || (source.url ? failedFavicons.has(source.url) : true)

                  return (
                    <li key={source.id} className="flex items-center text-sm">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        {source.url ? (
                          <>
                            <a
                              href={addUTM(source.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary group line-clamp-1 flex items-center gap-1 hover:underline"
                            >
                              {showFallback ? (
                                <div className="bg-muted h-4 w-4 flex-shrink-0 rounded-full" />
                              ) : (
                                <Image
                                  src={faviconUrl!}
                                  alt={`Favicon for ${source.title}`}
                                  width={16}
                                  height={16}
                                  className="h-4 w-4 flex-shrink-0 rounded-sm"
                                  onError={() => handleFaviconError(source.url!)}
                                />
                              )}
                              <span className="truncate">{source.title || source.id}</span>
                              <Link className="inline h-3 w-3 flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                            </a>
                            <div className="text-muted-foreground line-clamp-1 text-xs">
                              {formatUrl(source.url)}
                            </div>
                          </>
                        ) : (
                          <div className="text-foreground line-clamp-1 flex items-center gap-2">
                            <div className="bg-muted h-4 w-4 flex-shrink-0 rounded-full" />
                            <span className="truncate">{source.title || source.id}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
