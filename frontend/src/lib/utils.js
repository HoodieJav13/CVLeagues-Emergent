import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Display name for a free agent. The intake form writes first_name/last_name/
// display_name; legacy/seed records may only carry `name`. Prefer the chosen
// display name, fall back to the full legal name, then the legacy `name`.
export function freeAgentName(a) {
  if (!a) return "";
  const full = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  return a.display_name || full || a.name || "Unnamed";
}
