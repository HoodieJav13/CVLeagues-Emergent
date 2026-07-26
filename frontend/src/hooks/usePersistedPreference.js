import { useCallback, useEffect, useState } from "react";

/* ============================================================================
 * VIEW PREFERENCES — remembered UI choices, deliberately NOT application data.
 * ----------------------------------------------------------------------------
 * The mock-state boundary rule (localStorage is development-only; production
 * and preview fail closed rather than falling back to it) governs LEAGUE DATA.
 * This is a different thing: which sport or team someone last looked at holds
 * no league data, reveals nothing if absent, and is safe in production.
 *
 * It is kept under its own `cvf.pref.` namespace precisely so it can never be
 * mistaken for — or read as — the versioned mock-state envelope. Losing a
 * preference is a shrug; falling back to stale league data is not.
 * ========================================================================== */

const NAMESPACE = "cvf.pref.";

const readPreference = (key) => {
  try {
    return window.localStorage.getItem(NAMESPACE + key);
  } catch {
    // Private browsing and blocked storage are normal, not errors worth showing.
    return null;
  }
};

const writePreference = (key, value) => {
  try {
    if (value == null) window.localStorage.removeItem(NAMESPACE + key);
    else window.localStorage.setItem(NAMESPACE + key, value);
  } catch {
    /* preference simply is not remembered */
  }
};

/**
 * A useState whose value survives reloads.
 *
 * `isValid` guards against a remembered choice that no longer exists — a team
 * from a finished season, a sport that was removed. An invalid stored value is
 * discarded and the fallback is used, so a stale preference can never strand
 * someone on an empty view with no obvious way back.
 */
export function usePersistedPreference(key, fallback, isValid) {
  const [value, setValue] = useState(() => {
    const stored = readPreference(key);
    if (stored == null) return fallback;
    if (typeof isValid === "function" && !isValid(stored)) return fallback;
    return stored;
  });

  useEffect(() => {
    writePreference(key, value);
  }, [key, value]);

  // Re-validate when the option set changes underneath a remembered value.
  useEffect(() => {
    if (typeof isValid === "function" && !isValid(value)) setValue(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid]);

  const reset = useCallback(() => setValue(fallback), [fallback]);

  return [value, setValue, reset];
}
