import { createClient } from "@supabase/supabase-js";

/* Production and preview builds fail closed. Mock/localStorage data is a
 * development-only tool and can never become a deployed fallback. */

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
export const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY;
const productionBuild = process.env.NODE_ENV === "production";
const hasAnyBackendValue = Boolean(url || anonKey);
const hasCompleteBackend = Boolean(url && anonKey);

export const CONFIG_ERROR =
  hasAnyBackendValue && !hasCompleteBackend
    ? "Supabase configuration is incomplete."
    : productionBuild && !hasCompleteBackend
      ? "This deployment is missing its Supabase public configuration."
      : productionBuild && !TURNSTILE_SITE_KEY
        ? "This deployment is missing its public abuse-protection configuration."
        : null;

export const BACKEND_ENABLED = hasCompleteBackend && !CONFIG_ERROR;
export const MOCK_MODE = !productionBuild && !BACKEND_ENABLED && !CONFIG_ERROR;
export const supabase = BACKEND_ENABLED ? createClient(url, anonKey) : null;
