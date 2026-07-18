import React, { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppStateProvider } from "./context/AppStateContext";
import { RoleProvider } from "./context/RoleContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("./lib/supabase", () => ({
  CONFIG_ERROR: "This deployment is missing its Supabase public configuration.",
  BACKEND_ENABLED: false,
  MOCK_MODE: false,
}));
jest.mock("react-router-dom", () => ({
  BrowserRouter: ({ children }) => children,
  Routes: ({ children }) => children,
  Route: () => null,
  Link: ({ children }) => children,
  Outlet: () => null,
}));
jest.mock("./context/AppStateContext", () => ({ AppStateProvider: jest.fn(({ children }) => children) }));
jest.mock("./context/RoleContext", () => ({ RoleProvider: jest.fn(({ children }) => children) }));
jest.mock("./components/layout/AppLayout", () => ({ AppLayout: () => null }));
jest.mock("./pages/Home", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/Schedule", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/Standings", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/Playoffs", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/GameDetail", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/TeamPage", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/Leaderboards", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/AthleteProfile", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/TeamRegistration", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/FreeAgentSignup", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/FreeAgentPool", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/AdminDashboard", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/AdminRecovery", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/AdminResetPassword", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/AdminSecurity", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/ScoreEntry", () => ({ __esModule: true, default: () => null }));
jest.mock("./pages/NotFound", () => ({ __esModule: true, default: () => null }));

describe("configuration failure boundary", () => {
  test("renders the fail-closed screen before Auth or application state can mount", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<App />));

    expect(container.textContent).toContain("Configuration Required");
    expect(container.textContent).toContain("No mock or local data has been loaded");
    expect(RoleProvider).not.toHaveBeenCalled();
    expect(AppStateProvider).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });
});
