export function validateBrowserResult(browserResult) {
  if (!browserResult || typeof browserResult !== "object" || Array.isArray(browserResult)) {
    throw new Error("Result payload must be an object.");
  }

  const allowedTopLevel = new Set(["startedAt", "finishedAt", "checks"]);
  if (Object.keys(browserResult).some((key) => !allowedTopLevel.has(key))) {
    throw new Error("Result payload contained an unexpected top-level field.");
  }
  if (typeof browserResult.startedAt !== "string" || typeof browserResult.finishedAt !== "string" || !Array.isArray(browserResult.checks)) {
    throw new Error("Result payload did not match the expected report shape.");
  }

  const allowedCheckFields = new Set(["category", "name", "status", "detail"]);
  for (const check of browserResult.checks) {
    if (!check || typeof check !== "object" || Array.isArray(check) || Object.keys(check).some((key) => !allowedCheckFields.has(key))) {
      throw new Error("Result payload contained an unexpected check field.");
    }
    if (![check.category, check.name, check.status, check.detail].every((value) => typeof value === "string")) {
      throw new Error("Result payload contained a non-text check field.");
    }
    if (!["PASS", "FAIL"].includes(check.status)) {
      throw new Error("Result payload contained an invalid check status.");
    }
  }

  const serialized = JSON.stringify(browserResult);
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|Bearer\s+\S+|sb_(?:secret|publishable)_[A-Za-z0-9_-]+|"(?:refresh_token|access_token|password|captchaToken|adminTotp)"\s*:/i.test(serialized)) {
    throw new Error("Result payload contained a forbidden credential-shaped value.");
  }
}
