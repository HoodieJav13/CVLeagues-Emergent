import { createContext, useContext, useState } from "react";
import { ROLES } from "../lib/roles";

/* ============================================================================
 * RoleContext — holds the active DEMO role (preview switcher).
 * In production this would be derived from the authenticated user's role
 * (Supabase auth + profiles.role). Here it's local state for testing.
 * ========================================================================== */

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [role, setRole] = useState("anonymous");
  const roleMeta = ROLES[role];
  return (
    <RoleContext.Provider value={{ role, setRole, roleMeta }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
