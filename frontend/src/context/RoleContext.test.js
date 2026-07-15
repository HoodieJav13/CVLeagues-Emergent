import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { RoleProvider, useRole } from "./RoleContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockIsAdminRpc = jest.fn();
const mockIsAdminIdentity = jest.fn();
const mockGetMfaState = jest.fn();

jest.mock("../lib/supabase", () => ({
  BACKEND_ENABLED: true,
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
    },
    rpc: (...args) => mockIsAdminRpc(...args),
  },
}));

jest.mock("../lib/backend", () => ({
  isAdminIdentity: (...args) => mockIsAdminIdentity(...args),
  getMfaState: (...args) => mockGetMfaState(...args),
}));

function Probe() {
  const { role, authStatus, mfaFactor } = useRole();
  return (
    <output
      data-testid="role-state"
      data-role={role}
      data-status={authStatus}
      data-factor={mfaFactor?.id || ""}
    />
  );
}

const session = { user: { id: "admin-auth-user" }, access_token: "signed-token" };

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("RoleProvider fail-closed MFA authorization", () => {
  let container;
  let root;
  let authChange;
  let consoleError;
  const unsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    authChange = null;
    mockOnAuthStateChange.mockImplementation((callback) => {
      authChange = callback;
      return { data: { subscription: { unsubscribe } } };
    });
    mockGetSession.mockResolvedValue({ data: { session }, error: null });
    mockIsAdminIdentity.mockResolvedValue(true);
    mockGetMfaState.mockResolvedValue({
      currentLevel: "aal2",
      nextLevel: "aal2",
      verifiedFactors: [{ id: "totp-1", status: "verified" }],
    });
    mockIsAdminRpc.mockResolvedValue({ data: true, error: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    consoleError.mockRestore();
    container.remove();
  });

  const state = () => container.querySelector('[data-testid="role-state"]');

  async function renderProvider() {
    await act(async () => root.render(<RoleProvider><Probe /></RoleProvider>));
    await flush();
  }

  test("grants admin only after linked identity, AAL2, and the final database authorization all pass", async () => {
    await renderProvider();

    expect(state().dataset).toMatchObject({ role: "admin", status: "ready", factor: "" });
    expect(mockIsAdminIdentity).toHaveBeenCalledTimes(1);
    expect(mockGetMfaState).toHaveBeenCalledTimes(1);
    expect(mockIsAdminRpc).toHaveBeenCalledWith("is_admin");
  });

  test.each([
    {
      name: "signed out",
      setup: () => mockGetSession.mockResolvedValue({ data: { session: null }, error: null }),
      status: "signed_out",
      identityCalls: 0,
      mfaCalls: 0,
      rpcCalls: 0,
    },
    {
      name: "not the linked administrator",
      setup: () => mockIsAdminIdentity.mockResolvedValue(false),
      status: "unauthorized",
      identityCalls: 1,
      mfaCalls: 0,
      rpcCalls: 0,
    },
    {
      name: "linked but no verified factor",
      setup: () => mockGetMfaState.mockResolvedValue({ currentLevel: "aal1", nextLevel: "aal2", verifiedFactors: [] }),
      status: "mfa_enrollment",
      identityCalls: 1,
      mfaCalls: 1,
      rpcCalls: 0,
    },
    {
      name: "linked with a verified factor but still AAL1",
      setup: () => mockGetMfaState.mockResolvedValue({ currentLevel: "aal1", nextLevel: "aal2", verifiedFactors: [{ id: "totp-1", status: "verified" }] }),
      status: "mfa_challenge",
      factor: "totp-1",
      identityCalls: 1,
      mfaCalls: 1,
      rpcCalls: 0,
    },
  ])("keeps $name anonymous", async ({ setup, status, factor = "", identityCalls, mfaCalls, rpcCalls }) => {
    setup();
    await renderProvider();

    expect(state().dataset).toMatchObject({ role: "anonymous", status, factor });
    expect(mockIsAdminIdentity).toHaveBeenCalledTimes(identityCalls);
    expect(mockGetMfaState).toHaveBeenCalledTimes(mfaCalls);
    expect(mockIsAdminRpc).toHaveBeenCalledTimes(rpcCalls);
  });

  test.each([
    ["returns false", { data: false, error: null }],
    ["returns an error", { data: null, error: new Error("authorization unavailable") }],
  ])("keeps the role anonymous when the final is_admin RPC %s", async (_name, rpcResult) => {
    mockIsAdminRpc.mockResolvedValue(rpcResult);
    await renderProvider();

    expect(state().dataset).toMatchObject({ role: "anonymous", status: "error", factor: "" });
  });

  test("ignores a stale successful check after the session signs out", async () => {
    let resolveIdentity;
    mockIsAdminIdentity.mockImplementation(() => new Promise((resolve) => { resolveIdentity = resolve; }));

    await act(async () => root.render(<RoleProvider><Probe /></RoleProvider>));
    await flush();
    expect(state().dataset).toMatchObject({ role: "anonymous", status: "checking" });

    await act(async () => {
      authChange("SIGNED_OUT", null);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(state().dataset).toMatchObject({ role: "anonymous", status: "signed_out" });

    await act(async () => resolveIdentity(true));
    await flush();

    expect(state().dataset).toMatchObject({ role: "anonymous", status: "signed_out" });
    expect(mockGetMfaState).not.toHaveBeenCalled();
    expect(mockIsAdminRpc).not.toHaveBeenCalled();
  });
});
