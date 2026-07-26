/* ============================================================================
 * Admin venues tab.
 *
 * Migration 28 made games.venue_id required, so the operational contract under
 * test is that an administrator can create a venue before scheduling a game at
 * a new field — and that venues RETIRE rather than delete, because historical
 * games reference them and the database has no delete policy for any client.
 * ========================================================================== */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import VenuesTab, { isDuplicateVenue, venueDisplayName } from "./VenuesTab";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });
jest.mock("@/components/ui/button", () => jest.requireActual("../ui/button"), { virtual: true });
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

const { toast } = require("sonner");

const baseState = {
  venues: [
    { id: "v1", name: "Los Altos Park", field_label: "Field 1", address: "10500 Lomas Blvd NE", notes: "", status: "active" },
    { id: "v2", name: "Retired Yard", field_label: null, address: null, notes: "", status: "retired" },
  ],
  games: [{ id: "g1", venue_id: "v1" }, { id: "g2", venue_id: "v1" }],
};

const setInput = (element, value) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("venue identity helpers", () => {
  test("a missing field label collides with other missing field labels", () => {
    const venues = [{ id: "a", name: "Park", field_label: null }];
    expect(isDuplicateVenue(venues, { id: null, name: "park", field_label: "" })).toBe(true);
    expect(isDuplicateVenue(venues, { id: null, name: "Park", field_label: "Field 1" })).toBe(false);
  });

  test("a venue does not collide with itself while being edited", () => {
    const venues = [{ id: "a", name: "Park", field_label: "Field 1" }];
    expect(isDuplicateVenue(venues, { id: "a", name: "Park", field_label: "Field 1" })).toBe(false);
  });

  test("display name joins name and field label", () => {
    expect(venueDisplayName({ name: "Park", field_label: "Field 2" })).toBe("Park · Field 2");
    expect(venueDisplayName({ name: "Park", field_label: null })).toBe("Park");
  });
});

describe("admin venues tab", () => {
  let container;
  let root;
  let app;

  const render = async (state = baseState) => {
    app = {
      state,
      createEntity: jest.fn().mockResolvedValue(undefined),
      updateEntity: jest.fn().mockResolvedValue(undefined),
      deleteEntity: jest.fn(),
    };
    await act(async () => root.render(<VenuesTab app={app} />));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  test("lists venues with how many games are scheduled at each", async () => {
    await render();
    const row = container.querySelector('[data-testid="admin-venue-v1"]');
    expect(row.textContent).toContain("Los Altos Park");
    expect(row.textContent).toContain("Field 1");
    expect(container.querySelector('[data-testid="admin-venue-games-v1"]').textContent).toBe("2");
    expect(container.querySelector('[data-testid="admin-venue-games-v2"]').textContent).toBe("0");
  });

  test("prompts to add a venue when none exist, since a game cannot be scheduled without one", async () => {
    await render({ venues: [], games: [] });
    expect(container.textContent).toContain("No venues yet");
  });

  test("creates a venue with a trimmed name and null optional fields", async () => {
    await render();
    await act(async () => container.querySelector('[data-testid="admin-add-venue"]').click());
    await act(async () => setInput(document.querySelector('[data-testid="admin-venue-name"]'), "  West Mesa Fields  "));
    await act(async () => document.querySelector('[data-testid="admin-venue-save"]').click());

    expect(app.createEntity).toHaveBeenCalledWith(
      "venues",
      { name: "West Mesa Fields", field_label: null, address: null, notes: null, status: "active" },
      "v"
    );
  });

  test("refuses a venue with no name", async () => {
    await render();
    await act(async () => container.querySelector('[data-testid="admin-add-venue"]').click());
    await act(async () => document.querySelector('[data-testid="admin-venue-save"]').click());
    expect(app.createEntity).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Venue name required");
  });

  test("refuses a duplicate name and field pairing regardless of casing", async () => {
    await render();
    await act(async () => container.querySelector('[data-testid="admin-add-venue"]').click());
    await act(async () => {
      setInput(document.querySelector('[data-testid="admin-venue-name"]'), "los altos park");
      setInput(document.querySelector('[data-testid="admin-venue-field"]'), "field 1");
    });
    await act(async () => document.querySelector('[data-testid="admin-venue-save"]').click());
    expect(app.createEntity).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("A venue with that name and field already exists");
  });

  test("retires rather than deletes, and can reactivate", async () => {
    await render();
    await act(async () => container.querySelector('[data-testid="admin-retire-venue-v1"]').click());
    expect(app.updateEntity).toHaveBeenCalledWith("venues", "v1", { status: "retired" });
    expect(app.deleteEntity).not.toHaveBeenCalled();

    await act(async () => container.querySelector('[data-testid="admin-retire-venue-v2"]').click());
    expect(app.updateEntity).toHaveBeenCalledWith("venues", "v2", { status: "active" });
  });
});
