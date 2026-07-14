import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { Avatar } from "../common/Avatar";
import { SportBadge } from "../common/Badges";

// Desktop enhancement only: the trigger remains an ordinary link on touch
// devices, while the preview content is suppressed below the md breakpoint.
export const AthleteHoverCard = ({ profile, team, children }) => (
  <HoverCard openDelay={250} closeDelay={100}>
    <HoverCardTrigger asChild>{children}</HoverCardTrigger>
    <HoverCardContent sideOffset={8} className="hidden w-72 border-border bg-card p-4 shadow-lg md:block">
      <div className="flex items-center gap-3">
        <Avatar name={profile.name} color={profile.avatar_color} size={46} />
        <div className="min-w-0">
          <p className="truncate font-display text-base uppercase tracking-tight text-foreground">{profile.name}</p>
          <p className="text-xs text-muted-foreground">{profile.experience || "CVF athlete"}{team ? ` · ${team.name}` : ""}</p>
        </div>
      </div>
      {profile.sports?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">{profile.sports.map((sport) => <SportBadge key={sport} sport={sport} />)}</div>
      )}
      {profile.bio && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{profile.bio}</p>}
    </HoverCardContent>
  </HoverCard>
);
