import { useState } from "react";
import { Lock } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useRole } from "../../context/RoleContext";
import { ROLES } from "../../lib/roles";
import { BACKEND_ENABLED } from "../../lib/supabase";
import { signInAdmin } from "../../lib/backend";
import { Input } from "../ui/input";

/* Guards a page/section based on the active role. Reflects PRODUCTION
 * permission rules: non-permitted roles see an access-restricted message,
 * never the underlying controls.
 * Backend mode (Phase 9b): the gate doubles as the admin sign-in — Season 1
 * is admin-only login, so this is the app's entire auth surface. */
export const RoleGate = ({ allow = [], children, title = "Restricted Area" }) => {
  const { role } = useRole();
  if (allow.includes(role)) return children;
  if (BACKEND_ENABLED && allow.includes("admin")) return <AdminLogin title={title} />;
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

// Minimal admin sign-in (Supabase email/password). On success the auth
// listener in RoleContext flips role to admin and the gate opens.
const AdminLogin = ({ title }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInAdmin(email, password);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      data-testid="admin-login"
      className="bg-card border border-border rounded-2xl p-8 max-w-md mx-auto mt-8 space-y-4"
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <Lock size={22} weight="bold" className="text-primary" />
        </div>
        <p className="text-micro uppercase tracking-[0.25em] text-primary font-bold">CVF Operations</p>
        <h1 className="font-display uppercase text-heading text-foreground mt-1 mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground">Admin sign-in required.</p>
      </div>
      <label className="block">
        <span className="text-label uppercase text-muted-foreground mb-1.5 block">Email</span>
        <Input data-testid="admin-login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-surface-sunken border-border" />
      </label>
      <label className="block">
        <span className="text-label uppercase text-muted-foreground mb-1.5 block">Password</span>
        <Input data-testid="admin-login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-surface-sunken border-border" />
      </label>
      <button
        type="submit"
        disabled={busy}
        data-testid="admin-login-submit"
        className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm py-3 rounded-cvf-md hover:bg-teal-deep transition-colors disabled:opacity-40"
      >
        {busy ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
};
