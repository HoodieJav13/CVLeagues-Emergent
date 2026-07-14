import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ROLES } from "../lib/roles";
import { BACKEND_ENABLED, supabase } from "../lib/supabase";
import { getMfaState, isAdminIdentity } from "../lib/backend";

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
  const [authStatus, setAuthStatus] = useState(BACKEND_ENABLED ? "checking" : "mock");
  const [authError, setAuthError] = useState("");
  const [mfaFactor, setMfaFactor] = useState(null);
  const authCheckSequence = useRef(0);

  const verifySession = useCallback(async (nextSession) => {
      const checkSequence = ++authCheckSequence.current;
      setSession(nextSession);
      setBackendRole("anonymous");
      setMfaFactor(null);
      setAuthError("");

      if (!nextSession) {
        setAuthStatus("signed_out");
        return;
      }

      setAuthStatus("checking");
      try {
        const linkedAdmin = await isAdminIdentity();
        if (checkSequence !== authCheckSequence.current) return;
        if (!linkedAdmin) {
          setAuthStatus("unauthorized");
          return;
        }

        const mfa = await getMfaState();
        if (checkSequence !== authCheckSequence.current) return;
        if (!mfa.verifiedFactors.length) {
          setAuthStatus("mfa_enrollment");
          return;
        }
        if (mfa.currentLevel !== "aal2") {
          setMfaFactor(mfa.verifiedFactors[0]);
          setAuthStatus("mfa_challenge");
          return;
        }

        const { data, error } = await supabase.rpc("is_admin");
        if (checkSequence !== authCheckSequence.current) return;
        if (error || data !== true) throw error || new Error("AAL2 administrator authorization failed.");
        setBackendRole("admin");
        setAuthStatus("ready");
      } catch (error) {
        if (checkSequence !== authCheckSequence.current) return;
        console.error(error);
        setAuthError(error.message || "Administrator authentication failed.");
        setAuthStatus("error");
      }
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!BACKEND_ENABLED) return;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await verifySession(data.session);
  }, [verifySession]);

  useEffect(() => {
    if (!BACKEND_ENABLED) return undefined;

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => active && verifySession(data.session))
      .catch((error) => {
        if (!active) return;
        setAuthError(error.message || "Could not read the administrator session.");
        setAuthStatus("error");
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Keep the Auth callback synchronous; defer the hosted RPC check.
      setTimeout(() => active && verifySession(nextSession), 0);
    });

    return () => {
      active = false;
      authCheckSequence.current += 1;
      sub.subscription.unsubscribe();
    };
  }, [verifySession]);

  const role = BACKEND_ENABLED ? backendRole : demoRole;
  const setRole = BACKEND_ENABLED ? () => {} : setDemoRole;
  const roleMeta = ROLES[role];

  return (
    <RoleContext.Provider value={{ role, setRole, roleMeta, session, authStatus, authError, mfaFactor, refreshAuth }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
