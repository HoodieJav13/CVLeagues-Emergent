import { Lock } from "@phosphor-icons/react";
import { useRole } from "../../context/RoleContext";
import { ROLES } from "../../lib/roles";

/* Guards a page/section based on the active demo role. Reflects PRODUCTION
 * permission rules: non-permitted roles see an access-restricted message,
 * never the underlying controls. */
export const RoleGate = ({ allow = [], children, title = "Restricted Area" }) => {
  const { role } = useRole();
  if (allow.includes(role)) return children;
  const allowed = allow.map((r) => ROLES[r]?.label).filter(Boolean).join(" or ");
  return (
    <div
      data-testid="role-gate-denied"
      className="bg-card border border-border rounded-2xl p-8 text-center max-w-md mx-auto mt-8"
    >
      <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-4">
        <Lock size={22} weight="bold" className="text-destructive" />
      </div>
      <h1 className="font-display uppercase tracking-tight text-heading text-foreground mb-1">{title}</h1>
      <p className="text-sm text-muted-foreground">
        This area is available to <span className="text-foreground font-semibold">{allowed}</span>.
        Use the Demo Preview switcher to change roles.
      </p>
      <p className="text-micro text-muted-foreground/70 mt-3">
        In production, roles are assigned by an admin — users never self-promote.
      </p>
    </div>
  );
};
