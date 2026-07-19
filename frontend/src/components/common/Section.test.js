import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { SectionHeading } from "./Section";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

describe("SectionHeading title-token contract", () => {
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

  test.each([
    { as: "h1", band: true, expected: "text-display-xl", rejected: "text-display-lg" },
    { as: "h1", band: false, expected: "text-display-xl", rejected: "text-display-lg" },
    { as: "h2", band: true, expected: "text-display-lg", rejected: "text-display-xl" },
    { as: "h2", band: false, expected: "text-display-lg", rejected: "text-display-xl" },
  ])("renders $as with band=$band using $expected", async ({ as, band, expected, rejected }) => {
    await act(async () => root.render(<SectionHeading as={as} band={band} title="Competition" />));

    const heading = container.querySelector(as);
    expect(heading?.className).toContain(expected);
    expect(heading?.className).not.toContain(rejected);
  });
});
