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
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0f0f0f]/95 backdrop-blur-md border-t border-border flex justify-around items-stretch z-40"
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
              `flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} weight={isActive ? "fill" : "regular"} />
                <span className="text-[10px] font-semibold uppercase tracking-wide">
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
