import * as React from "react"

import { cn } from "@/lib/utils"

const densitySpacing = {
  compact: "0.875rem",
  default: "1.25rem",
  spacious: "1.75rem",
}

const Card = React.forwardRef(({ className, density = "default", style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-card", className)}
    style={{ "--card-spacing": densitySpacing[density] || densitySpacing.default, ...style }}
    {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-[var(--card-spacing)]", className)}
    {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-[var(--card-spacing)] pb-[var(--card-spacing)]", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center px-[var(--card-spacing)] pb-[var(--card-spacing)]", className)}
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
