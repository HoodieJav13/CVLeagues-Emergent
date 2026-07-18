import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppStateProvider, useApp } from "./AppStateContext";
import * as backend from "../lib/backend";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/supabase", () => ({ BACKEND_ENABLED: true }));
jest.mock("./RoleContext", () => ({ useRole: () => ({ role: "anonymous" }) }));
jest.mock("../lib/backend", () => ({ fetchAppState: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), info: jest.fn() } }));

function Probe() {
  const { state } = useApp();
  return <output data-testid="backend-state">{state.source}</output>;
}

describe("backend mode storage isolation", () => {
  let container;
  let root;
  let getItem;
  let setItem;

  beforeEach(() => {
    backend.fetchAppState.mockResolvedValue({ source: "hosted" });
    getItem = jest.spyOn(Storage.prototype, "getItem");
    setItem = jest.spyOn(Storage.prototype, "setItem");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    getItem.mockRestore();
    setItem.mockRestore();
    container.remove();
  });

  test("loads hosted state without reading or writing localStorage", async () => {
    await act(async () => {
      root.render(<AppStateProvider><Probe /></AppStateProvider>);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="backend-state"]')?.textContent).toBe("hosted");
    expect(backend.fetchAppState).toHaveBeenCalledWith(false);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
