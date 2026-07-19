import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { StatStrip, StructuralCorner, StructuralIdentityBadge } from "./StructuralIdentity";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("structural identity primitives", () => {
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

  test("renders a team-colored octagonal fallback with three structural rays", async () => {
    await act(async () => root.render(
      <StructuralIdentityBadge team={{ name: "Rio Runners", logo_color: "#5BB8CC" }} testId="identity" />
    ));

    const badge = container.querySelector('[data-testid="identity"]');
    expect(badge?.textContent).toBe("RR");
    expect(badge?.getAttribute("aria-hidden")).toBe("true");
    expect(badge?.style.getPropertyValue("--cvf-identity-color")).toBe("#5BB8CC");
    expect(badge?.querySelectorAll(".cvf-structural-corner > span")).toHaveLength(3);
  });

  test("allows the structural corner to encode a state tone and position", async () => {
    await act(async () => root.render(<StructuralCorner tone="gold" position="bottom-left" />));

    const corner = container.querySelector(".cvf-structural-corner");
    expect(corner?.getAttribute("data-position")).toBe("bottom-left");
    expect(corner?.style.getPropertyValue("--cvf-structural-color")).toBe("var(--cvf-gold)");
  });

  test("renders a three-cell continuous stat strip", async () => {
    await act(async () => root.render(
      <StatStrip
        testId="stats"
        items={[
          { key: "wins", label: "Wins", value: 7 },
          { key: "losses", label: "Losses", value: 2 },
          { key: "differential", label: "Point Diff", value: "+18" },
        ]}
      />
    ));

    const strip = container.querySelector('[data-testid="stats"]');
    expect(strip?.tagName).toBe("DL");
    expect(strip?.querySelectorAll(".cvf-stat-strip__cell")).toHaveLength(3);
    expect(strip?.textContent).toContain("Point Diff+18");
  });
});
