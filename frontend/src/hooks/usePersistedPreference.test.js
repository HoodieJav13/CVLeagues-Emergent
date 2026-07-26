/* ============================================================================
 * View-preference persistence.
 *
 * The behaviour that matters: a remembered choice that is no longer valid must
 * be discarded rather than applied, and blocked storage must never throw into
 * the render path.
 * ========================================================================== */
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { usePersistedPreference } from "./usePersistedPreference";

const NAMESPACE = "cvf.pref.";

function Probe({ storageKey, fallback, isValid, onReady }) {
  const [value, setValue] = usePersistedPreference(storageKey, fallback, isValid);
  onReady({ value, setValue });
  return <span data-testid="value">{value}</span>;
}

describe("usePersistedPreference", () => {
  let container;
  let root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  const render = async (props) => {
    let api = null;
    await act(async () => root.render(<Probe {...props} onReady={(next) => { api = next; }} />));
    return () => api;
  };

  test("falls back when nothing has been stored", async () => {
    await render({ storageKey: "sport", fallback: "all" });
    expect(container.querySelector('[data-testid="value"]').textContent).toBe("all");
  });

  test("restores a previously stored value", async () => {
    window.localStorage.setItem(`${NAMESPACE}sport`, "kickball");
    await render({ storageKey: "sport", fallback: "all" });
    expect(container.querySelector('[data-testid="value"]').textContent).toBe("kickball");
  });

  test("persists under the cvf.pref namespace, never the mock-state key", async () => {
    const api = await render({ storageKey: "sport", fallback: "all" });
    await act(async () => api().setValue("flag_football"));
    expect(window.localStorage.getItem(`${NAMESPACE}sport`)).toBe("flag_football");
    // The mock-state envelope is a separate concern and must not be touched.
    expect(window.localStorage.getItem("cvf_app_state_v10")).toBeNull();
  });

  test("discards a stored value that is no longer valid", async () => {
    window.localStorage.setItem(`${NAMESPACE}sport`, "curling");
    await render({
      storageKey: "sport",
      fallback: "all",
      isValid: (value) => ["all", "kickball"].includes(value),
    });
    expect(container.querySelector('[data-testid="value"]').textContent).toBe("all");
  });

  test("keeps a stored value that is still valid", async () => {
    window.localStorage.setItem(`${NAMESPACE}sport`, "kickball");
    await render({
      storageKey: "sport",
      fallback: "all",
      isValid: (value) => ["all", "kickball"].includes(value),
    });
    expect(container.querySelector('[data-testid="value"]').textContent).toBe("kickball");
  });

  test("blocked storage degrades to the fallback instead of throwing", async () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    await render({ storageKey: "sport", fallback: "all" });
    expect(container.querySelector('[data-testid="value"]').textContent).toBe("all");
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
