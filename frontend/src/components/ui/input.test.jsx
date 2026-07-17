import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Input } from "./input";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

test("Input keeps focus and disabled states without broad transitions", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => root.render(<Input data-testid="input-contract" disabled />));
  const input = container.querySelector('[data-testid="input-contract"]');

  expect(input?.className).not.toContain("transition-all");
  expect(input?.className).not.toContain("duration-200");
  expect(input?.className).toContain("focus-visible:ring-2");
  expect(input?.className).toContain("disabled:opacity-50");

  await act(async () => root.unmount());
  container.remove();
});
