import { NavLink } from "react-router-dom";
import {
  House,
  CalendarBlank,
  Ranking,
  Trophy,
  User,
  Users,
  ShieldCheck,
  PencilSimpleLine,
} from "@phosphor-icons/react";
import { useRole } from "../../context/RoleContext";
import { navItemsForRole } from "../../lib/roles";

const ICONS = {
  house: House,
  calendar: CalendarBlank,
  ranking: Ranking,
  trophy: Trophy,
  user: User,
  users: Users,
  shield: ShieldCheck,
  pencil: PencilSimpleLine,
};

// Sticky bottom navigation for mobile. Items adapt to the active demo role.
export const BottomNav = () => {
  const { role } = useRole();
  const items = navItemsForRole(role);
  return (
    <nav
      data-testid="bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 box-content pb-[env(safe-area-inset-bottom)] bg-[#0F1416]/95 backdrop-blur-md border-t border-border flex justify-around items-stretch z-40"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon] || House;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            data-testid={`navmobile-${item.label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200 relative pt-0.5 ${
                isActive
                  ? "text-primary after:absolute after:top-0 after:inset-x-3 after:h-0.5 after:rounded-b-full after:bg-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} weight={isActive ? "fill" : "regular"} />
                <span className="text-micro font-semibold uppercase tracking-wide">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
