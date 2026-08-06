import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Bomb() {
  throw new Error("deliberate render failure");
}

describe("ErrorBoundary", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("renders children when nothing throws", async () => {
    await act(async () => root.render(<ErrorBoundary><p>healthy content</p></ErrorBoundary>));
    expect(container.textContent).toContain("healthy content");
    expect(container.querySelector('[data-testid="app-error-boundary"]')).toBeNull();
  });

  test("a render error shows the branded card with a reload action, not a white screen", async () => {
    // React logs caught errors loudly; keep the test output readable.
    const silenced = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(async () => root.render(<ErrorBoundary><Bomb /></ErrorBoundary>));
      expect(container.querySelector('[data-testid="app-error-boundary"]')).not.toBeNull();
      const button = container.querySelector("button");
      expect(button?.textContent).toMatch(/reload/i);
      // The error's own message never reaches the visitor's screen.
      expect(container.textContent).not.toContain("deliberate render failure");
    } finally {
      silenced.mockRestore();
    }
  });
});
