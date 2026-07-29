import { Link } from "react-router-dom";
import { Crown } from "@phosphor-icons/react";
import { StructuralIdentityBadge } from "../direction/StructuralIdentity";
import { EligibilityIndicator } from "../common/EligibilityIndicator";
import { AthleteHoverCard } from "./AthleteHoverCard";

// Roster register row (Pass 4 Team/Profile batch): one hairline row per
// player — badge, name with the crown/eligibility details worth keeping,
// position and jersey right-aligned. Rendered inside a bordered list, not a
// card grid; the roster reads like a lineup, not a contact list.
export const PlayerCard = ({ profile, jersey_number, position, isCaptain }) => (
  <AthleteHoverCard profile={profile}>
    <Link
      to={`/profile/${profile.id}`}
      data-testid={`player-card-${profile.id}`}
      className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-2 last:border-0 transition-colors hover:bg-white/5 active:bg-white/10"
    >
      <StructuralIdentityBadge className="cvf-identity-badge--md" color={profile.avatar_color} name={profile.name} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate font-display text-base uppercase tracking-tight text-foreground">
          {profile.name}
        </span>
        {isCaptain && <Crown size={14} weight="fill" className="text-gold shrink-0" />}
        <EligibilityIndicator status={profile.eligibility_status} />
      </span>
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {position}
        {jersey_number != null && <span className="font-mono-score tabular-nums"> · #{jersey_number}</span>}
      </span>
    </Link>
  </AthleteHoverCard>
);
