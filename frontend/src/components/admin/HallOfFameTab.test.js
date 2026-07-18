import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import HallOfFameTab from "./HallOfFameTab";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });
jest.mock("@/components/ui/button", () => jest.requireActual("../ui/button"), { virtual: true });

const initialState = {
  hofEntries: [],
  profiles: [{ id: "profile-1", name: "Alex Curator" }],
  seasons: [{ name: "Summer 2026" }],
  games: [],
  teams: [],
  settings: {
    current_season: "Summer 2026",
    current_seasons: { kickball: "Summer 2026", flag_football: "Summer 2026" },
    hof_published: false,
  },
};

function HallOfFameHarness() {
  const [state, setState] = useState(initialState);
  const createEntity = async (collection, entity) => {
    setState((current) => ({ ...current, [collection]: [...current[collection], { id: "hof-1", ...entity }] }));
  };
  const updateEntity = async (collection, id, patch) => {
    setState((current) => ({
      ...current,
      [collection]: current[collection].map((entry) => entry.id === id ? { ...entry, ...patch } : entry),
    }));
  };
  const deleteEntity = async (collection, id) => {
    setState((current) => ({ ...current, [collection]: current[collection].filter((entry) => entry.id !== id) }));
  };

  return <HallOfFameTab app={{ state, createEntity, updateEntity, deleteEntity, setHofPublished: jest.fn() }} />;
}

function click(element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function selectPlayer() {
  const trigger = document.querySelector('[data-testid="hof-profile"]');
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  const option = [...document.querySelectorAll('[role="option"]')]
    .find((item) => item.textContent.includes("Alex Curator"));
  expect(option).not.toBeUndefined();
  await act(async () => {
    click(option);
  });
}

describe("HallOfFameTab curation", () => {
  let container;
  let root;

  beforeAll(() => {
    global.PointerEvent = MouseEvent;
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("creates, edits, and deletes a curated entry through the admin UI", async () => {
    await act(async () => root.render(<HallOfFameHarness />));

    await act(async () => click(container.querySelector('[data-testid="hof-add-entry"]')));
    await selectPlayer();
    await act(async () => setInputValue(document.querySelector('[data-testid="hof-title"]'), "First Induction"));
    await act(async () => click(document.querySelector('[data-testid="hof-save-entry"]')));

    expect(container.querySelector('[data-testid="hof-entry-hof-1"]')?.textContent).toContain("First Induction");

    await act(async () => click(container.querySelector('[aria-label="Edit entry"]')));
    await act(async () => setInputValue(document.querySelector('[data-testid="hof-title"]'), "Updated Induction"));
    await act(async () => click(document.querySelector('[data-testid="hof-save-entry"]')));

    expect(container.querySelector('[data-testid="hof-entry-hof-1"]')?.textContent).toContain("Updated Induction");

    await act(async () => click(container.querySelector('[aria-label="Delete entry"]')));
    const deleteButton = [...document.querySelectorAll("button")].find((button) => button.textContent === "Delete");
    await act(async () => click(deleteButton));

    expect(container.querySelector('[data-testid="hof-entry-hof-1"]')).toBeNull();
    expect(container.textContent).toContain("No curated entries");
  }, 15000);
});
