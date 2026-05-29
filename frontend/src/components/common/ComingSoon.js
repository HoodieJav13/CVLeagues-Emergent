import { LockSimple } from "@phosphor-icons/react";

// Disabled "Coming Soon" placeholder for Phase 2 features
// (team chat, photo upload, push notifications, etc.).
export const ComingSoon = ({ label, className = "" }) => (
  <div
    className={`flex items-center gap-2 opacity-50 cursor-not-allowed select-none rounded-lg border border-dashed border-border px-3 py-2 ${className}`}
    data-testid={`coming-soon-${(label || "feature").toLowerCase().replace(/\s+/g, "-")}`}
    title="Coming in Phase 2"
  >
    <LockSimple size={15} weight="bold" className="text-muted-foreground" />
    <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
      {label} · Coming Soon
    </span>
  </div>
);
