import { useEffect, useRef } from "react";
import { BACKEND_ENABLED, TURNSTILE_SITE_KEY } from "../../lib/supabase";

let loader;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cvf-turnstile="true"]');
    const script = existing || document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("Human verification timed out.")), 10000);
    script.addEventListener("load", () => {
      window.clearTimeout(timeout);
      window.turnstile?.ready(() => resolve(window.turnstile));
    }, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Human verification could not load."));
    }, { once: true });
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.cvfTurnstile = "true";
      document.head.appendChild(script);
    }
  });
  return loader;
}

export function TurnstileWidget({ action, onToken, onError, resetSignal = 0 }) {
  const container = useRef(null);
  const widgetId = useRef(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!BACKEND_ENABLED || !TURNSTILE_SITE_KEY) return undefined;
    let active = true;
    loadTurnstile()
      .then((turnstile) => {
        if (!active || !container.current) return;
        widgetId.current = turnstile.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: "dark",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => {
            onTokenRef.current("");
            onErrorRef.current?.("Human verification failed to load.");
          },
        });
      })
      .catch((error) => onErrorRef.current?.(error.message));
    return () => {
      active = false;
      if (widgetId.current != null && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [action]);

  useEffect(() => {
    if (resetSignal && widgetId.current != null && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      onTokenRef.current("");
    }
  }, [resetSignal]);

  if (!BACKEND_ENABLED) return null;
  if (!TURNSTILE_SITE_KEY) {
    return <p className="text-xs text-destructive">Human verification is not configured.</p>;
  }
  return <div ref={container} data-testid={`turnstile-${action}`} className="min-h-[65px]" />;
}
