// Explicit draft persistence, never an app-data fallback. Namespace and envelope
// both bind records to a backend project and actor. The fixture namespace cannot
// be selected in production. This is isolation from accidental reuse, not encryption.
export function draftScope({ backend, mock, production, project, actor, role, authStatus }) {
  if (role !== "admin") return null;
  if (backend) {
    if (authStatus !== "ready" || !actor || !project) return null;
    try { return JSON.stringify(["backend", new URL(project).origin, actor]); } catch { return null; }
  }
  return mock && !production ? JSON.stringify(["fixture", "local-admin"]) : null;
}

export function createDraftStorage(browser, scope) {
  const prefix = `cvf.commissioner.scope.v1.${encodeURIComponent(scope)}.`;
  const keyFor = (key) => prefix + key;
  return {
    acceptsEvent: (key) => key === null || key.startsWith(prefix),
    keyFor,
    getItem(key) {
      const result = this.readScoped(key);
      return result.valid ? result.payload : JSON.stringify({ schema: "cvf.invalid-scoped-draft" });
    },
    getRecoveryItem(key) { return this.readScoped(key).payload; },
    readScoped(key) {
      const raw = browser.localStorage.getItem(keyFor(key));
      if (raw === null) return { valid: true, payload: null };
      try {
        const envelope = JSON.parse(raw);
        if (envelope?.schema === "cvf.commissioner.scope" && envelope.version === 1
          && envelope.scope === scope && typeof envelope.payload === "string"
          && Object.keys(envelope).sort().join() === "payload,schema,scope,version") return { valid: true, payload: envelope.payload };
      } catch { /* Preserve untrusted bytes for the explicit recovery path. */ }
      return { valid: false, payload: raw };
    },
    setItem(key, payload) {
      browser.localStorage.setItem(keyFor(key), JSON.stringify({ schema: "cvf.commissioner.scope", version: 1, scope, payload }));
    },
  };
}
