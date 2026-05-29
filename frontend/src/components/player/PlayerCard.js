import { Link } from "react-router-dom";
import { Crown } from "@phosphor-icons/react";
import { Avatar } from "../common/Avatar";

// Compact roster player card linking to athlete profile.
export const PlayerCard = ({ profile, jersey, position, isCaptain }) => (
  <Link
    to={`/profile/${profile.id}`}
    data-testid={`player-card-${profile.id}`}
    className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 transition-all duration-200 hover:border-primary/50 hover:-translate-y-0.5"
  >
    <Avatar name={profile.name} color={profile.avatarColor} size={42} />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="font-display uppercase tracking-tight text-white truncate text-base">
          {profile.name}
        </span>
        {isCaptain && <Crown size={14} weight="fill" className="text-[#facc15] shrink-0" />}
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {position}
        {jersey != null && <span className="font-mono"> · #{jersey}</span>}
      </p>
    </div>
  </Link>
);
