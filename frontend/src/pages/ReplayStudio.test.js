/* ============================================================================
 * Replay Studio rendered inside the real mock-mode AppStateProvider (jsdom):
 * attach the fictional recording, save highlights from the editor, build and
 * save a reel, keep drafts private, share, and see the second viewer's frozen
 * snapshot; missing footage is reported, not guessed. Media decoding and real
 * playback are covered by the headless browser journey, not here.
 * ========================================================================== */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppStateProvider, useApp } from "../context/AppStateContext";
import ReplayStudio from "./ReplayStudio";
import { FIXTURE_INDEX } from "../lib/__fixtures__/replayIndex";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@/lib/utils", () => ({ cn: (...classes) => classes.filter(Boolean).join(" ") }), { virtual: true });
jest.mock("../lib/supabase", () => ({ BACKEND_ENABLED: false }));
jest.mock("../context/RoleContext", () => ({ useRole: () => ({ role: "anonymous" }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("react-router-dom", () => ({
  useParams: () => ({ gameId: "g7" }),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../components/replay/replayIO", () => {
  const actual = jest.requireActual("../components/replay/replayIO");
  return {
    ...actual,
    // Every segment file is present with its registered hash unless a test says otherwise.
    useMediaCheck: (recording) => [
      Object.fromEntries((recording?.segments || []).map((s) => [s.id, { state: global.__missing?.includes(s.id) ? "missing" : "ok", sha256: s.media.sha256 }])),
      () => {},
    ],
    helperHealth: async () => ({ ok: false, reason: "not-running" }),
  };
});

let app;
function Harness() { app = useApp(); return <ReplayStudio />; }
const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const click = async (id) => { const el = q(id); if (!el) throw new Error(`missing ${id}`); await act(async () => { el.click(); }); };
const type = async (id, value) => {
  const el = q(id);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("Replay Studio (mock mode)", () => {
  let container;
  let root;
  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    global.__missing = [];
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => FIXTURE_INDEX }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<AppStateProvider><Harness /></AppStateProvider>));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const makeClip = async (segment, inMs, outMs, title, tagIds = []) => {
    await click(`replay-segment-${segment}`);
    await type("replay-in", inMs);
    await type("replay-out", outMs);
    await type("replay-clip-title", title);
    for (const id of tagIds) await click(id);
    await click("replay-save-clip");
    await flush();
  };

  test("attach → three highlights → reel order → private draft → share → second viewer sees the snapshot", async () => {
    expect(q("replay-no-recording")).not.toBeNull();
    await click("replay-attach");
    await flush();
    expect(q("replay-gap").textContent).toMatch(/5 min gap/);

    await makeClip("rec-g7-s1", 12000, 18000, "Opening drive", ["replay-tag-team-t4", "replay-tag-player-p17"]);
    await makeClip("rec-g7-s1", 55500, 59800, "Right before the gap");
    await makeClip("rec-g7-s2", 22000, 30000, "Mavericks score", ["replay-tag-team-t5"]);
    expect(app.state.replayClips).toHaveLength(3);
    expect(app.state.replayClips[0]).toMatchObject({ owner_id: "viewer-jordan", in_ms: 12000, out_ms: 18000, tags: { team_ids: ["t4"], profile_ids: ["p17"] } });
    expect(q(`replay-clip-${app.state.replayClips[1].id}`).textContent).toMatch(/Near the edge of Segment A/);

    // An out-of-bounds end is refused before saving.
    await click("replay-segment-rec-g7-s2");
    await type("replay-in", 40000);
    await type("replay-out", 46000);
    expect(q("replay-clip-problems").textContent).toMatch(/after this segment ends/);
    expect(q("replay-save-clip").disabled).toBe(true);

    const [c1, c2, c3] = app.state.replayClips.map((c) => c.id);
    for (const id of [c3, c1, c2]) await click(`replay-add-${id}`);
    await click("replay-save-reel");
    await flush();
    expect(app.state.replayReels[0]).toMatchObject({ clip_ids: [c3, c1, c2], status: "draft", owner_id: "viewer-jordan" });
    expect(q("replay-reel-status").textContent).toMatch(/Private draft/);
    // Export without the helper running says so plainly; the manifest is still offered.
    await click("replay-render");
    await flush();
    expect(q("replay-export-failed").textContent).toMatch(/export helper is not running/);

    // Second viewer: no drafts, nothing shared yet.
    await click("replay-viewer-viewer-rachel");
    expect(q("replay-no-clips")).not.toBeNull();
    expect(q("replay-shared-empty")).not.toBeNull();
    await click("replay-viewer-viewer-jordan");
    await click("replay-publish");
    await flush();
    await click("replay-viewer-viewer-rachel");
    const reelId = app.state.replayReels[0].id;
    expect(q(`replay-shared-${reelId}`).textContent).toMatch(/Mavericks score.*Opening drive.*Right before the gap/);
    expect(q("replay-no-clips")).not.toBeNull(); // Rachel still has no access to Jordan's drafts
  });

  test("missing footage is stated per segment and blocks marking in that segment", async () => {
    global.__missing = ["rec-g7-s2"];
    await click("replay-attach");
    await flush();
    expect(q("replay-media-problems").textContent).toMatch(/Segment B footage is missing/);
    await click("replay-segment-rec-g7-s2");
    expect(q("replay-player-unavailable").textContent).toMatch(/missing/);
    expect(q("replay-mark-in").disabled).toBe(true);
  });

  test("an unreadable recording index is reported, and nothing is registered", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    await click("replay-attach");
    await flush();
    expect(q("replay-attach-error").textContent).toMatch(/isn't on this computer yet/);
    expect(app.state.replayRecordings || []).toEqual([]);
  });

  test("review R1: deleting a highlight works and reports success without throwing", async () => {
    const { toast } = require("sonner");
    await click("replay-attach");
    await flush();
    await makeClip("rec-g7-s1", 12000, 18000, "To delete");
    const id = app.state.replayClips[0].id;
    toast.success.mockClear();
    await click(`replay-delete-${id}`);
    await flush();
    expect(app.state.replayClips).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("Highlight deleted");
  });

  test("review R2: switching viewers mid-edit does not carry unsaved highlight or reel work across", async () => {
    await click("replay-attach");
    await flush();
    await makeClip("rec-g7-s1", 12000, 18000, "Jordan saved");
    await type("replay-in", 30000);
    await type("replay-clip-title", "Jordan unsaved draft");
    await click("replay-tag-team-t4");
    await click(`replay-add-${app.state.replayClips[0].id}`);
    await type("replay-reel-title", "Jordan unsaved reel");
    await click("replay-viewer-viewer-rachel");
    expect(q("replay-clip-title").value).toBe("");
    expect(q("replay-in").value).toBe("");
    expect(q("replay-tag-team-t4").getAttribute("aria-pressed")).toBe("false");
    expect(q("replay-reel-title").value).toBe("My highlights");
    expect(q("replay-reel-order").textContent).toMatch(/Add highlights/);
  });

  test("review R6: preview skips highlights whose footage is not available, and says so", async () => {
    await click("replay-attach");
    await flush();
    await makeClip("rec-g7-s1", 12000, 18000, "A ok");
    await makeClip("rec-g7-s2", 22000, 26000, "B gone");
    for (const c of app.state.replayClips) await click(`replay-add-${c.id}`);
    await click("replay-save-reel");
    await flush();
    global.__missing = ["rec-g7-s2"];
    await click("replay-viewer-viewer-rachel");
    await click("replay-viewer-viewer-jordan"); // re-render with the new media state
    await click("replay-preview-reel");
    expect(q("replay-reel-preview-position").textContent).toMatch(/Clip 1 of 1: A ok/);
    expect(q("replay-reel-preview-skipped").textContent).toMatch(/1 highlight skipped/);
  });
});
