import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { LedgerScorekeeper } from "./LedgerScorekeeper";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockApp;
const mockNavigate = jest.fn();

jest.mock("@/lib/utils", () => ({ cn: (...classes) => classes.filter(Boolean).join(" ") }), { virtual: true });
jest.mock("../../context/AppStateContext", () => ({ useApp: () => mockApp }));
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../ui/select", () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
}));

const game = {
  id: "game-ledger", sport: "kickball", status: "upcoming", score_status: "pending", locked: false,
  scorekeeping_mode: "aggregate", home_team_id: "home", away_team_id: "away",
};

const baseState = {
  teams: [{ id: "home", name: "Home" }, { id: "away", name: "Away" }],
  scorekeepingSessions: [], scorekeepingParticipants: [], scorekeepingEvents: [],
};

const click = async (element) => {
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
};

describe("LedgerScorekeeper", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockApp = {
      state: baseState,
      startScorekeepingSession: jest.fn().mockResolvedValue({ session_id: "session-1", session_kind: "ordinary", lease_token: "token", lease_version: 1 }),
      resumeScorekeepingSession: jest.fn(), renewScorekeepingSession: jest.fn(), appendScorekeepingEvent: jest.fn(), replaceScorekeepingEvent: jest.fn(),
      finalizeScorekeepingSession: jest.fn(), startScorekeepingCorrection: jest.fn(), cancelScorekeepingSession: jest.fn(),
      declareLedgerForfeit: jest.fn(),
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  test("offers an explicit ledger start and W/L-only forfeit path", async () => {
    await act(async () => root.render(<LedgerScorekeeper game={game} onExit={jest.fn()} />));
    expect(container.textContent).toContain("Live event ledger");
    expect(container.textContent).toContain("Start live scorekeeping");
    expect(container.textContent).toContain("Record a forfeit");
  });

  test("restores a fresh lease for an active session after reload", async () => {
    mockApp.state = { ...baseState, scorekeepingSessions: [{ id: "session-active", game_id: game.id, status: "open" }] };
    mockApp.resumeScorekeepingSession.mockResolvedValue({ session_id: "session-active", session_kind: "ordinary", lease_token: "fresh", lease_version: 4 });
    await act(async () => root.render(<LedgerScorekeeper game={{ ...game, scorekeeping_mode: "ledger", status: "live" }} onExit={jest.fn()} />));
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Resume session")));
    expect(mockApp.resumeScorekeepingSession).toHaveBeenCalledWith("session-active", "Resume after reload");
    expect(container.textContent).toContain("Lease v4");
  });

  test("keeps a locked public result unchanged while opening a reasoned correction", async () => {
    mockApp.startScorekeepingCorrection.mockResolvedValue({ session_id: "correction-1", session_kind: "correction", lease_token: "fresh", lease_version: 1 });
    await act(async () => root.render(<LedgerScorekeeper game={{ ...game, status: "completed", score_status: "final", locked: true, scorekeeping_mode: "ledger", outcome_type: "played" }} onExit={jest.fn()} />));
    const textarea = container.querySelector("textarea");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(textarea, "Official scorer correction");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click([...container.querySelectorAll("button")].find((button) => button.textContent.includes("Open correction draft")));
    expect(mockApp.startScorekeepingCorrection).toHaveBeenCalledWith(game.id, "Official scorer correction");
  });

  test("renders a locked forfeit receipt without reopening scorekeeping", async () => {
    await act(async () => root.render(<LedgerScorekeeper game={{
      ...game, status: "canceled", score_status: "final", locked: true, scorekeeping_mode: "ledger",
      outcome_type: "forfeit", winner_team_id: "away", loser_team_id: "home", forfeit_reason: "No show",
    }} onExit={jest.fn()} />));

    expect(container.textContent).toContain("Final forfeit");
    expect(container.textContent).toContain("Away · W");
    expect(container.textContent).not.toContain("Start live scorekeeping");
    expect(container.textContent).not.toContain("Declare forfeit");
  });

  test("[INV-08] a tied evaluation transitions to the next OT period without navigating", async () => {
    mockApp.state = {
      ...baseState,
      scorekeepingSessions: [{ id: "session-active", game_id: game.id, status: "open" }],
      scorekeepingEvents: [{
        id: "event-1", game_id: game.id, session_id: "session-active",
        action: "record", event_type: "run", period_type: "regulation",
        period_number: 1, credited_team_id: "home", points: 1,
      }],
    };
    mockApp.resumeScorekeepingSession.mockResolvedValue({
      session_id: "session-active",
      session_kind: "ordinary",
      lease_token: "fresh",
      lease_version: 4,
    });
    mockApp.finalizeScorekeepingSession.mockResolvedValue({
      ok: true,
      status: "continue_overtime",
      next_overtime_period: 2,
      message: "The completed period remains tied; continue overtime.",
    });

    await act(async () => root.render(
      <LedgerScorekeeper
        game={{ ...game, scorekeeping_mode: "ledger", status: "live" }}
        onExit={jest.fn()}
      />
    ));
    await click([...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Resume session")));
    await click([...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Evaluate final score")));

    expect(mockApp.finalizeScorekeepingSession).toHaveBeenCalledWith(expect.objectContaining({
      lease: expect.objectContaining({ session_id: "session-active", lease_version: 4 }),
      idempotency_key: expect.any(String),
    }));
    expect(container.textContent).toContain("OT 2");
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
