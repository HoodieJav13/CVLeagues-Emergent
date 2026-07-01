import { Link, useLocation } from "react-router-dom";
import { CaretDown } from "@phosphor-icons/react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";

// Mobile-only sticky conversion CTA. Sticks just BELOW the top bar (never the
// bottom — must not collide with the fixed BottomNav). Tapping "Join" opens the
// two existing intake routes. Navigation only — no new functionality.
//
// Hidden where it doesn't make sense: the intake forms themselves (redundant),
// and the admin / score-entry / captain free-agent surfaces (not public
// conversion). On desktop these actions are already reachable, so it's md:hidden.
const HIDE_ON = ["/register-team", "/free-agent-signup", "/free-agents", "/admin", "/score-entry"];

export const MobileJoinBar = () => {
  const { pathname } = useLocation();
  if (HIDE_ON.includes(pathname)) return null;

  return (
    <div className="md:hidden sticky top-16 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            data-testid="mobile-join"
            aria-label="Join CVF Sports"
            className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] bg-primary text-primary-foreground rounded-cvf-md uppercase tracking-widest text-body-strong hover:bg-teal-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Join <CaretDown size={16} weight="bold" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" sideOffset={8} className="w-[calc(100vw-2rem)] p-2">
          <div className="space-y-1">
            <Link
              to="/register-team"
              data-testid="mobile-join-team"
              className="flex items-center min-h-[44px] px-3 rounded-cvf-md text-body-strong text-foreground hover:bg-surface-sunken transition-colors"
            >
              Submit Team Interest
            </Link>
            <Link
              to="/free-agent-signup"
              data-testid="mobile-join-agent"
              className="flex items-center min-h-[44px] px-3 rounded-cvf-md text-body-strong text-foreground hover:bg-surface-sunken transition-colors"
            >
              Join Free Agent Pool
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
