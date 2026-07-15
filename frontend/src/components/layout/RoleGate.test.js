import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { RoleGate } from "./RoleGate";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockRoleState;

jest.mock("../../context/RoleContext", () => ({
  useRole: () => mockRoleState,
}));

jest.mock("../../lib/supabase", () => ({
  BACKEND_ENABLED: true,
}));

jest.mock("../../lib/backend", () => ({
  enrollTotp: jest.fn(),
  signInAdmin: jest.fn(),
  signOutAdmin: jest.fn(),
  verifyMfaCode: jest.fn(),
}));

jest.mock("../common/TurnstileWidget", () => ({
  TurnstileWidget: () => <div data-testid="turnstile" />,
}));

jest.mock("react-router-dom", () => ({
  Link: ({ children }) => <span>{children}</span>,
}), { virtual: true });

jest.mock("@/lib/utils", () => ({
  cn: (...classes) => classes.filter(Boolean).join(" "),
}), { virtual: true });

describe("RoleGate admin transitions", () => {
  let container;
  let root;

  beforeEach(() => {
    mockRoleState = {
      role: "anonymous",
      authStatus: "signed_out",
      authError: "",
      mfaFactor: { id: "totp-1" },
      refreshAuth: jest.fn(),
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(status = mockRoleState.authStatus, role = "anonymous") {
    mockRoleState = { ...mockRoleState, role, authStatus: status };
    await act(async () => root.render(<RoleGate allow={["admin"]}><div data-testid="protected">Private admin content</div></RoleGate>));
  }

  test.each([
    ["checking", "Checking administrator security", null],
    ["mfa_enrollment", null, "admin-mfa-enrollment"],
    ["mfa_challenge", null, "admin-mfa-challenge"],
    ["unauthorized", "not the linked CVF administrator", null],
    ["error", "authorization service unavailable", null],
    ["signed_out", null, "admin-login"],
  ])("renders the fail-closed %s state without protected content", async (status, text, testId) => {
    mockRoleState.authError = status === "error" ? "authorization service unavailable" : "";
    await render(status);

    expect(container.querySelector('[data-testid="protected"]')).toBeNull();
    if (text) expect(container.textContent).toContain(text);
    if (testId) expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
  });

  test("renders protected content only for the verified admin role", async () => {
    await render("ready", "anonymous");
    expect(container.querySelector('[data-testid="protected"]')).toBeNull();

    await render("ready", "admin");
    expect(container.querySelector('[data-testid="protected"]')?.textContent).toBe("Private admin content");
  });
});
