import { createContext, useContext, useEffect, useState } from "react";
import { ROLES } from "../lib/roles";
import { BACKEND_ENABLED, supabase } from "../lib/supabase";

/* ============================================================================
 * RoleContext.
 * Mock mode: the active DEMO role from the env-gated preview switcher.
 * Backend mode (Phase 9b): the role is REAL — 'admin' iff a Supabase auth
 * session exists (admin-only login, Season 1), 'anonymous' otherwise. The
 * demo switcher is inert in backend mode; setRole is a no-op there.
 * ========================================================================== */

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [demoRole, setDemoRole] = useState("anonymous");
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const role = BACKEND_ENABLED ? (session ? "admin" : "anonymous") : demoRole;
  const setRole = BACKEND_ENABLED ? () => {} : setDemoRole;
  const roleMeta = ROLES[role];

  return (
    <RoleContext.Provider value={{ role, setRole, roleMeta, session }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
