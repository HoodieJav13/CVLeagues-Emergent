import { useEffect, useLayoutEffect, useRef } from "react";
import { BACKEND_ENABLED, TURNSTILE_SITE_KEY } from "../../lib/supabase";

const SCRIPT_SELECTOR = 'script[data-cvf-turnstile="true"]';
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const LOAD_TIMEOUT_MS = 10000;

let loader;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;

  const pending = new Promise((resolve, reject) => {
    const existing = document.querySelector(SCRIPT_SELECTOR);
    const script = existing || document.createElement("script");

    const settle = (callback, value, removeScript = false) => {
      window.clearTimeout(timeout);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if (removeScript) script.remove();
      callback(value);
    };
    const fail = (message) => settle(reject, new Error(message), true);
    const handleLoad = () => {
      if (!window.turnstile || typeof window.turnstile.render !== "function") {
        fail("Human verification could not initialize.");
        return;
      }
      settle(resolve, window.turnstile);
    };
    const handleError = () => fail("Human verification could not load.");
    const timeout = window.setTimeout(() => fail("Human verification timed out."), LOAD_TIMEOUT_MS);

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    if (!existing) {
      script.src = SCRIPT_URL;
      script.dataset.cvfTurnstile = "true";
      document.head.appendChild(script);
    }
  });

  loader = pending;
  pending.then(
    () => { if (loader === pending) loader = undefined; },
    () => { if (loader === pending) loader = undefined; },
  );
  return pending;
}

export function TurnstileWidget({ action, onToken, onError, resetSignal = 0 }) {
  const container = useRef(null);
  const widgetId = useRef(null);
  const turnstileApi = useRef(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useLayoutEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onToken, onError]);

  useEffect(() => {
    if (!BACKEND_ENABLED || !TURNSTILE_SITE_KEY) return undefined;
    let active = true;
    loadTurnstile()
      .then((turnstile) => {
        if (!active || !container.current) return;
        turnstileApi.current = turnstile;

        const resetAfterFailure = (message) => {
          if (!active) return;
          onTokenRef.current?.("");
          onErrorRef.current?.(message);
          if (widgetId.current == null) return;
          try {
            turnstile.reset(widgetId.current);
          } catch {
            onErrorRef.current?.("Human verification could not reset. Please reload and try again.");
          }
        };

        try {
          widgetId.current = turnstile.render(container.current, {
            sitekey: TURNSTILE_SITE_KEY,
            action,
            theme: "dark",
            callback: (token) => { if (active) onTokenRef.current?.(token); },
            "expired-callback": () => resetAfterFailure("Human verification expired. Please complete it again."),
            "timeout-callback": () => resetAfterFailure("Human verification timed out. Please complete it again."),
            "error-callback": () => {
              if (!active) return true;
              onTokenRef.current?.("");
              onErrorRef.current?.("Human verification failed to load.");
              return true;
            },
          });
        } catch {
          onTokenRef.current?.("");
          onErrorRef.current?.("Human verification could not initialize.");
        }
      })
      .catch((error) => {
        if (!active) return;
        onTokenRef.current?.("");
        onErrorRef.current?.(error.message);
      });
    return () => {
      active = false;
      if (widgetId.current != null && turnstileApi.current) {
        try {
          turnstileApi.current.remove(widgetId.current);
        } catch {
          // The third-party widget may already have removed itself.
        }
      }
      widgetId.current = null;
      turnstileApi.current = null;
    };
  }, [action]);

  useEffect(() => {
    if (!resetSignal || widgetId.current == null || !turnstileApi.current) return;
    try {
      turnstileApi.current.reset(widgetId.current);
      onTokenRef.current?.("");
    } catch {
      onTokenRef.current?.("");
      onErrorRef.current?.("Human verification could not reset. Please reload and try again.");
    }
  }, [resetSignal]);

  if (!BACKEND_ENABLED) return null;
  if (!TURNSTILE_SITE_KEY) {
    return <p className="text-xs text-destructive">Human verification is not configured.</p>;
  }
  return <div ref={container} data-testid={`turnstile-${action}`} className="min-h-[65px]" />;
}
