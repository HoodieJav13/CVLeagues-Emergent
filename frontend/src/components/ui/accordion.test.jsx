import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

describe("Accordion motion contract", () => {
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

  test("scopes motion to the caret and disables disclosure movement when reduced", async () => {
    await act(async () => {
      root.render(
        <Accordion type="single" defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger data-testid="accordion-trigger-contract">Player</AccordionTrigger>
            <AccordionContent data-testid="accordion-content-contract">Stats</AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    });

    const trigger = container.querySelector('[data-testid="accordion-trigger-contract"]');
    const caret = trigger?.querySelector("svg");
    const content = container.querySelector('[data-testid="accordion-content-contract"]');

    expect(trigger?.className).not.toContain("transition-all");
    expect(trigger?.className).toContain("[&[data-state=open]>svg]:rotate-180");
    expect(caret?.getAttribute("class")).toContain("transition-transform");
    expect(caret?.getAttribute("class")).toContain("duration-cvf-fast");
    expect(caret?.getAttribute("class")).toContain("ease-cvf-out");
    expect(caret?.getAttribute("class")).toContain("motion-reduce:!transform-none");
    expect(caret?.getAttribute("class")).toContain("motion-reduce:transition-none");
    expect(content?.className).toContain("data-[state=closed]:animate-accordion-up");
    expect(content?.className).toContain("data-[state=open]:animate-accordion-down");
    expect(content?.className).toContain("motion-reduce:!animate-none");
  });
});
