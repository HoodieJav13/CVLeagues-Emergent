import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

describe("Dialog motion contract", () => {
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

  test("normalizes overlay and content motion without changing centering", async () => {
    await act(async () => {
      root.render(
        <Dialog open>
          <DialogContent data-testid="dialog-content-contract">
            <DialogTitle>Test dialog</DialogTitle>
            <DialogDescription>Test description</DialogDescription>
          </DialogContent>
        </Dialog>
      );
    });

    const content = document.querySelector('[data-testid="dialog-content-contract"]');
    const overlay = document.querySelector('[data-state="open"].fixed.inset-0');

    for (const element of [overlay, content]) {
      const classes = element?.className.split(/\s+/) || [];
      expect(classes).toContain("!duration-cvf-fast");
      expect(classes).not.toContain("duration-cvf-fast");
      expect(element?.className).toContain("ease-cvf-out");
      expect(element?.className).toContain("motion-reduce:!animate-none");
    }
    expect(content?.className).toContain("translate-x-[-50%]");
    expect(content?.className).toContain("translate-y-[-50%]");
    expect(content?.className).not.toContain("duration-200");
  });
});
