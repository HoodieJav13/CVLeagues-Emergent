import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Textarea } from "./textarea";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

test("Textarea keeps focus and disabled states without broad transitions", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => root.render(<Textarea data-testid="textarea-contract" disabled />));
  const textarea = container.querySelector('[data-testid="textarea-contract"]');

  expect(textarea?.className).not.toContain("transition-all");
  expect(textarea?.className).not.toContain("duration-200");
  expect(textarea?.className).toContain("focus-visible:ring-2");
  expect(textarea?.className).toContain("disabled:opacity-50");

  await act(async () => root.unmount());
  container.remove();
});
