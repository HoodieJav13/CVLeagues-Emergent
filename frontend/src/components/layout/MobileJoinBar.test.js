import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MobileJoinBar } from "./MobileJoinBar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: "/" }),
}), { virtual: true });

jest.mock("../ui/popover", () => ({
  Popover: ({ children }) => <div>{children}</div>,
  PopoverTrigger: ({ children }) => children,
  PopoverContent: ({ children, ...props }) => {
    const domProps = { ...props };
    delete domProps.align;
    delete domProps.sideOffset;
    return <div {...domProps}>{children}</div>;
  },
}));

describe("MobileJoinBar motion contract", () => {
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

  test("reports disclosure state through the caret without losing intake routes", async () => {
    await act(async () => root.render(<MobileJoinBar />));

    const trigger = container.querySelector('[data-testid="mobile-join"]');
    const caret = container.querySelector('[data-testid="mobile-join-caret"]');

    expect(trigger?.getAttribute("type")).toBe("button");
    expect(trigger?.className).not.toContain("transition-");
    expect(trigger?.className).not.toContain("active:scale-");
    expect(caret?.classList.toString()).toContain("group-data-[state=open]:rotate-180");
    expect(caret?.classList.toString()).toContain("motion-reduce:transition-none");
    expect(container.querySelectorAll('a[href="/register-team"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/free-agent-signup"]')).toHaveLength(1);
  });
});
