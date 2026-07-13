import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ROLES } from "../lib/roles";
import { BACKEND_ENABLED, supabase } from "../lib/supabase";

/* ============================================================================
 * RoleContext.
 * Mock mode: the active DEMO role from the env-gated preview switcher.
 * Backend mode (Phase 9b): the role is REAL — 'admin' only when the current
 * Supabase Auth session passes the hosted is_admin() check, 'anonymous'
 * otherwise. The demo switcher is inert in backend mode; setRole is a no-op.
 * ========================================================================== */

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [demoRole, setDemoRole] = useState("anonymous");
  const [session, setSession] = useState(null);
  const [backendRole, setBackendRole] = useState("anonymous");
  const authCheckSequence = useRef(0);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;

    let active = true;

    const verifySession = async (nextSession) => {
      if (!active) return;

      const checkSequence = ++authCheckSequence.current;
      setSession(nextSession);
      // Fail closed while the hosted authorization check is in flight.
      setBackendRole("anonymous");

      if (!nextSession) return;

      const { data, error } = await supabase.rpc("is_admin");
      if (!active || checkSequence !== authCheckSequence.current) return;

      setBackendRole(!error && data === true ? "admin" : "anonymous");
    };

    supabase.auth
      .getSession()
      .then(({ data }) => verifySession(data.session))
      .catch(() => verifySession(null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Keep the Auth callback synchronous; defer the hosted RPC check.
      setTimeout(() => verifySession(nextSession), 0);
    });

    return () => {
      active = false;
      authCheckSequence.current += 1;
      sub.subscription.unsubscribe();
    };
  }, []);

  const role = BACKEND_ENABLED ? backendRole : demoRole;
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
