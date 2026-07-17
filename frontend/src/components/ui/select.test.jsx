import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Select, SelectTrigger, SelectValue } from "./select";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

describe("SelectTrigger visual contract", () => {
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

  test("owns the public control height, readable type, and restrained motion", async () => {
    await act(async () => {
      root.render(
        <Select defaultValue="all">
          <SelectTrigger data-testid="select-contract">
            <SelectValue />
          </SelectTrigger>
        </Select>
      );
    });

    const trigger = container.querySelector('[data-testid="select-contract"]');
    expect(trigger?.className).toContain("h-11");
    expect(trigger?.className).toContain("text-base");
    expect(trigger?.className).toContain("data-[placeholder]:text-muted-foreground");
    expect(trigger?.className).not.toContain("text-muted-foreground/60");
    expect(trigger?.className).not.toContain("transition-all");
    expect(trigger?.className).not.toContain("duration-200");
  });
});
