import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { PracticeScorekeeper } from "./PracticeScorekeeper";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockApp;

jest.mock("@/lib/utils", () => ({ cn: (...classes) => classes.filter(Boolean).join(" ") }), { virtual: true });
jest.mock("../../context/AppStateContext", () => ({ useApp: () => mockApp }));
// Interactive Select mock: SelectItem buttons dispatch the surrounding
// Select's onValueChange so tests can actually choose teams/events/players.
jest.mock("../ui/select", () => {
  const ReactActual = require("react");
  const Ctx = ReactActual.createContext(() => {});
  return {
    Select: ({ children, onValueChange }) => (
      <Ctx.Provider value={onValueChange}><div data-mock-select>{children}</div></Ctx.Provider>
    ),
    SelectTrigger: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
    SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
    SelectContent: ({ children }) => <div>{children}</div>,
    SelectItem: ({ children, value }) => {
      const onValueChange = ReactActual.useContext(Ctx);
      return <button type="button" data-select-item={value} onClick={() => onValueChange?.(value)}>{children}</button>;
    },
  };
});

const baseState = {
  leagues: [{ id: "l1", sport: "flag_football", season: "Summer 2026" }],
  teams: [
    { id: "home", name: "Home", league_id: "l1" },
    { id: "away", name: "Away", league_id: "l1" },
    { id: "third", name: "Third", league_id: "l1" },
  ],
  profiles: [],
  scorekeepingSessions: [],
  scorekeepingParticipants: [],
  scorekeepingEvents: [],
  scorekeepingEventAttributions: [],
};

const click = async (element) => {
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
};

const setInputValue = async (input, value) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("PracticeScorekeeper", () => {
  let container;
  let root;

  const pickOption = async (triggerLabel, value) => {
    const trigger = container.querySelector(`[aria-label="${triggerLabel}"]`);
    const wrapper = trigger.closest("[data-mock-select]");
    await click(wrapper.querySelector(`[data-select-item="${value}"]`));
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockApp = {
      state: baseState,
      startPracticeSession: jest.fn().mockResolvedValue({
        session_id: "practice-1", session_kind: "practice", lease_token: "token", lease_version: 1,
      }),
      appendPracticeEvent: jest.fn().mockResolvedValue({ event_id: "event-1", sequence_number: 1 }),
      renewPracticeSession: jest.fn(),
      resumePracticeSession: jest.fn(),
      cancelPracticeSession: jest.fn(),
      finalizePracticeSession: jest.fn(),
      startPracticeCorrection: jest.fn(),
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test("renders the PRACTICE chip and starts a session with the chosen teams", async () => {
    await act(async () => root.render(<PracticeScorekeeper onExit={jest.fn()} />));
    expect(container.textContent).toContain("PRACTICE — no consequences");
    expect(container.querySelector('[data-testid="practice-chip"]')).not.toBeNull();

    await pickOption("Practice home team", "home");
    await pickOption("Practice away team", "away");
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Start practice session")));

    expect(mockApp.startPracticeSession).toHaveBeenCalledWith({
      home_team_id: "home",
      away_team_id: "away",
      rule_version: "CVF-2026.1",
      regulation_period_count: 4,
      overtime_start_setting: "",
      rules_snapshot: { captured_by: "practice-mode", version: "CVF-2026.1" },
    });
    // The active session surface keeps the register visible.
    expect(container.querySelector('[data-testid="practice-chip"]')).not.toBeNull();
  });

  test("builds a signed-yards carry command in practice mode", async () => {
    mockApp.state = {
      ...baseState,
      scorekeepingParticipants: [
        { id: "part-h", session_id: "practice-1", team_id: "home", profile_id: "p1", display_name: "Hank Rusher" },
        { id: "part-a", session_id: "practice-1", team_id: "away", profile_id: "p2", display_name: "Ada Away" },
      ],
    };
    await act(async () => root.render(<PracticeScorekeeper onExit={jest.fn()} />));
    await pickOption("Practice home team", "home");
    await pickOption("Practice away team", "away");
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Start practice session")));

    await pickOption("Practice event", "carry");
    await pickOption("Primary player", "part-h");
    await setInputValue(container.querySelector('[data-testid="practice-yards"]'), "-3");
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Record event")));

    expect(mockApp.appendPracticeEvent).toHaveBeenCalledWith({
      lease: expect.objectContaining({ session_id: "practice-1" }),
      command: expect.objectContaining({
        action: "record",
        event_type: "carry",
        credited_team_id: "home",
        points: 0,
        idempotency_key: expect.any(String),
        attributions: [
          { participant_id: "part-h", role: "rusher", stat_key: "carries", stat_delta: 1 },
          { participant_id: "part-h", role: "rusher", stat_key: "rushYards", stat_delta: -3 },
        ],
      }),
    });
  });

  test("finalize renders the returned projection preview in place instead of navigating", async () => {
    mockApp.state = {
      ...baseState,
      profiles: [{ id: "p1", name: "Hank Rusher" }],
      scorekeepingSessions: [{
        id: "practice-1", game_id: null, session_kind: "practice", status: "open",
        sport: "flag_football", home_team_id: "home", away_team_id: "away", base_session_id: null,
      }],
      scorekeepingEvents: [{
        id: "event-1", session_id: "practice-1", game_id: null, sequence_number: 1,
        action: "record", event_type: "touchdown", period_type: "regulation",
        period_number: 1, credited_team_id: "home", points: 6,
      }],
    };
    mockApp.resumePracticeSession.mockResolvedValue({
      session_id: "practice-1", session_kind: "practice", lease_token: "fresh", lease_version: 3,
    });
    mockApp.finalizePracticeSession.mockResolvedValue({
      ok: true,
      status: "practice_finalized",
      session_id: "practice-1",
      home_score: 6,
      away_score: 0,
      warnings: [],
      projection: { player_stats: { p1: { team_id: "home", stats: { tds: 1 } } } },
    });

    await act(async () => root.render(<PracticeScorekeeper onExit={jest.fn()} />));
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Resume practice session")));
    expect(container.textContent).toContain("Lease v3");
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Evaluate practice projection")));

    expect(mockApp.finalizePracticeSession).toHaveBeenCalledWith(expect.objectContaining({
      lease: expect.objectContaining({ session_id: "practice-1", lease_version: 3 }),
      idempotency_key: expect.any(String),
    }));
    // The preview replaces the session UI in place — the component stays
    // mounted on the same surface (it has no router dependency at all).
    expect(container.querySelector('[data-testid="practice-projection-preview"]')).not.toBeNull();
    expect(container.textContent).toContain("Projection preview");
    expect(container.textContent).toContain("Hank Rusher");
    expect(container.textContent).toContain("Rehearse a correction");
    expect(container.querySelector('[data-testid="practice-chip"]')).not.toBeNull();
  });
});
