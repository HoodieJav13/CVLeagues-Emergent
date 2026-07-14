import { Link } from "react-router-dom";
import { Crown } from "@phosphor-icons/react";
import { Avatar } from "../common/Avatar";
import { EligibilityIndicator } from "../common/EligibilityIndicator";
import { AthleteHoverCard } from "./AthleteHoverCard";

// Compact roster player card linking to athlete profile.
export const PlayerCard = ({ profile, jersey_number, position, isCaptain }) => (
  <AthleteHoverCard profile={profile}>
    <Link
      to={`/profile/${profile.id}`}
      data-testid={`player-card-${profile.id}`}
      className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 shadow-card transition-all duration-200 hover:border-primary/50 hover:-translate-y-1 hover:shadow-card-hover active:translate-y-0 active:scale-[0.99]"
    >
      <Avatar name={profile.name} color={profile.avatar_color} size={42} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display uppercase tracking-tight text-foreground truncate text-base">
            {profile.name}
          </span>
          {isCaptain && <Crown size={14} weight="fill" className="text-gold shrink-0" />}
          <EligibilityIndicator status={profile.eligibility_status} />
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {position}
          {jersey_number != null && <span className="tabular-nums"> · #{jersey_number}</span>}
        </p>
      </div>
    </Link>
  </AthleteHoverCard>
);
