import { NavLink } from "react-router-dom";
import { Logo } from "../brand/Logo";
import { useRole } from "../../context/RoleContext";
import { navItemsForRole } from "../../lib/roles";

// Desktop top app bar. Hidden on mobile (bottom nav used instead).
export const TopBar = () => {
  const { role } = useRole();
  const items = navItemsForRole(role);
  return (
    <header className="sticky top-0 z-30 bg-[#0f0f0f]/90 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-semibold uppercase tracking-wide transition-colors ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
};
