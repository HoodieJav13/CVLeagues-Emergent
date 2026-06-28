import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Display name for a free agent. The intake form writes firstName/lastName/
// displayName; legacy/seed records may only carry `name`. Prefer the chosen
// display name, fall back to the full legal name, then the legacy `name`.
export function freeAgentName(a) {
  if (!a) return "";
  const full = [a.firstName, a.lastName].filter(Boolean).join(" ").trim();
  return a.displayName || full || a.name || "Unnamed";
}
