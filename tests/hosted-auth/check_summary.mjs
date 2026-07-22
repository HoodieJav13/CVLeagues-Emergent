export function summarizeChecks(browserChecks = [], catalogChecks = []) {
  const checks = [...catalogChecks, ...browserChecks];
  const passed = (items) => items.filter((check) => check.status === "PASS").length;
  const browserPassed = passed(browserChecks);
  const catalogPassed = passed(catalogChecks);
  const combinedPassed = browserPassed + catalogPassed;

  return {
    checks,
    browserPassed,
    browserFailed: browserChecks.length - browserPassed,
    catalogPassed,
    catalogFailed: catalogChecks.length - catalogPassed,
    combinedPassed,
    combinedFailed: checks.length - combinedPassed,
  };
}
