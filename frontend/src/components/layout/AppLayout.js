import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { RoleSwitcher } from "../RoleSwitcher";

// The Demo Role Preview switcher is an ADMIN-ONLY TESTING TOOL that exists only
// because this MVP has no real auth (CLAUDE.md). It must NEVER ship in a public
// build. It renders in local development by default; a production build only
// includes it when explicitly opted in via REACT_APP_SHOW_ROLE_SWITCHER=true.
// PHASE 2: delete the switcher entirely — role comes from the authed session.
const SHOW_ROLE_SWITCHER =
  process.env.NODE_ENV !== "production" || process.env.REACT_APP_SHOW_ROLE_SWITCHER === "true";

// App shell: desktop top bar + mobile bottom nav + (dev-only) role switcher.
export const AppLayout = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <TopBar />
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-5 pb-28 md:pb-12">
      <Outlet />
    </main>
    <BottomNav />
    {SHOW_ROLE_SWITCHER && <RoleSwitcher />}
  </div>
);
