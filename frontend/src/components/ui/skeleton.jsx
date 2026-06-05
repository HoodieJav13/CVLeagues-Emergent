import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-white/5 border border-white/5", className)}
      {...props} />
  );
}

export { Skeleton }
