import { createClient } from "@supabase/supabase-js";

/* ============================================================================
 * Supabase client — env-gated (Phase 9b wiring).
 * ----------------------------------------------------------------------------
 * With both env vars set the app runs against the real backend; without them
 * it runs exactly as before on mock seed + localStorage. This keeps `main`
 * shippable in both modes until the hosted project is provisioned.
 *
 *   REACT_APP_SUPABASE_URL       — project URL
 *   REACT_APP_SUPABASE_ANON_KEY  — anon/public key (safe to expose; RLS rules)
 * ========================================================================== */

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const BACKEND_ENABLED = Boolean(url && anonKey);
export const supabase = BACKEND_ENABLED ? createClient(url, anonKey) : null;
