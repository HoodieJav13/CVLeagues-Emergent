import { ShieldCheck, ShieldWarning } from "@phosphor-icons/react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";

/* ============================================================================
 * EligibilityIndicator — reusable, purely INFORMATIONAL status chip.
 * ----------------------------------------------------------------------------
 * Icon + tooltip + screen-reader text (NOT color-alone, so it stays
 * accessible). It NEVER blocks, disables, or gates anything anywhere — the
 * admin enforces eligibility physically in real life (CLAUDE.md). Shown next
 * to player names on rosters, score entry, and team pages.
 *
 * PHASE 2: `status` is sourced from the player's profile eligibility flag for
 * now; it becomes real waiver verification status against the backend.
 * ========================================================================== */
const META = {
  verified: { Icon: ShieldCheck, color: "#5BB8CC", label: "Eligible — waiver verified" },
  not_verified: { Icon: ShieldWarning, color: "#F5B82E", label: "Waiver not verified" },
};

export const EligibilityIndicator = ({ status, size = 15, className = "" }) => {
  const { Icon, color, label } = META[status] || META.not_verified;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-testid={`eligibility-${status === "verified" ? "verified" : "not-verified"}`}
            className={`inline-flex items-center shrink-0 ${className}`}
            role="img"
            aria-label={label}
            tabIndex={0}
          >
            <Icon size={size} weight="fill" style={{ color }} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
