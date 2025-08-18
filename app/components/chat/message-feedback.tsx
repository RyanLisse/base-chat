"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

export type FeedbackType = "upvote" | "downvote" | null

interface MessageFeedbackProps {
  messageId: string
  initialFeedback?: FeedbackType
  className?: string
  langsmithRunId?: string
}

export function MessageFeedback({
  messageId,
  initialFeedback = null,
  className,
  langsmithRunId
}: MessageFeedbackProps) {
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackType>(initialFeedback)
  const [showCommentDialog, setShowCommentDialog] = useState(false)
  const [comment, setComment] = useState("")

  const feedbackMutation = useMutation({
    mutationFn: async ({ 
      feedback, 
      comment 
    }: { 
      feedback: FeedbackType
      comment?: string 
    }) => {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId,
          feedback,
          comment,
          langsmithRunId
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit feedback")
      }

      return response.json()
    },
    onSuccess: (_, { feedback }) => {
      setCurrentFeedback(feedback)
      setShowCommentDialog(false)
      setComment("")
      toast.success(
        feedback === "upvote" 
          ? "Thanks for the positive feedback!" 
          : "Thanks for the feedback!"
      )
    },
    onError: () => {
      toast.error("Failed to submit feedback. Please try again.")
    }
  })

  const handleFeedback = (feedback: FeedbackType) => {
    if (currentFeedback === feedback) {
      // Remove feedback if clicking same button
      setCurrentFeedback(null)
      feedbackMutation.mutate({ feedback: null })
    } else if (feedback === "downvote") {
      // Show comment dialog for downvotes
      setShowCommentDialog(true)
    } else {
      // Submit upvote immediately
      feedbackMutation.mutate({ feedback })
    }
  }

  const submitDownvote = () => {
    feedbackMutation.mutate({ 
      feedback: "downvote", 
      comment: comment.trim() || undefined 
    })
  }

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "size-8 p-0 hover:bg-green-50 hover:text-green-600",
                currentFeedback === "upvote" && "bg-green-50 text-green-600"
              )}
              onClick={() => handleFeedback("upvote")}
              disabled={feedbackMutation.isPending}
            >
              <ThumbsUp 
                className="size-4" 
                weight={currentFeedback === "upvote" ? "fill" : "regular"}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{currentFeedback === "upvote" ? "Remove upvote" : "Helpful response"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "size-8 p-0 hover:bg-red-50 hover:text-red-600",
                currentFeedback === "downvote" && "bg-red-50 text-red-600"
              )}
              onClick={() => handleFeedback("downvote")}
              disabled={feedbackMutation.isPending}
            >
              <ThumbsDown 
                className="size-4" 
                weight={currentFeedback === "downvote" ? "fill" : "regular"}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{currentFeedback === "downvote" ? "Remove downvote" : "Not helpful"}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Help us improve</DialogTitle>
            <DialogDescription>
              What could we do better? Your feedback helps us improve the assistant.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Please tell us what went wrong or how we could improve..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCommentDialog(false)}
              disabled={feedbackMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={submitDownvote}
              disabled={feedbackMutation.isPending}
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}