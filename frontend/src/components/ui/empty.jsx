import * as React from "react"

import { cn } from "@/lib/utils"

const Empty = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="empty"
    className={cn("flex min-w-0 flex-col items-center justify-center text-center", className)}
    {...props}
  />
))
Empty.displayName = "Empty"

const EmptyHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="empty-header" className={cn("flex max-w-sm flex-col items-center gap-1", className)} {...props} />
))
EmptyHeader.displayName = "EmptyHeader"

const EmptyMedia = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="empty-media" className={cn("mb-2 flex items-center justify-center text-muted-foreground", className)} {...props} />
))
EmptyMedia.displayName = "EmptyMedia"

const EmptyTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} data-slot="empty-title" className={cn("font-display text-subheading uppercase tracking-tight text-foreground", className)} {...props} />
))
EmptyTitle.displayName = "EmptyTitle"

const EmptyDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} data-slot="empty-description" className={cn("max-w-xs text-caption text-muted-foreground", className)} {...props} />
))
EmptyDescription.displayName = "EmptyDescription"

const EmptyContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="empty-content" className={cn("mt-3 flex items-center justify-center", className)} {...props} />
))
EmptyContent.displayName = "EmptyContent"

export { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent }
