import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { MobileJoinBar } from "./MobileJoinBar";
import { RoleSwitcher } from "../RoleSwitcher";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { MOCK_MODE } from "../../lib/supabase";

// The Demo Role Preview switcher is an ADMIN-ONLY TESTING TOOL that exists only
// because this MVP has no real auth (CLAUDE.md). It must NEVER ship in a public
// build. It renders in local development by default; a production build only
// includes it when explicitly opted in via REACT_APP_SHOW_ROLE_SWITCHER=true.
// PHASE 2: delete the switcher entirely — role comes from the authed session.
const SHOW_ROLE_SWITCHER = process.env.NODE_ENV === "development" && MOCK_MODE;

// App shell: desktop top bar + mobile bottom nav + (dev-only) role switcher.
export const AppLayout = () => {
  useDocumentTitle();
  return (
  <div className="min-h-screen bg-background flex flex-col">
    <TopBar />
    <MobileJoinBar />
    {/* pb clears the fixed mobile BottomNav (h-16) so the last content / form
        field is never covered; smaller padding on desktop where there's no nav. */}
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-5 pb-32 md:pb-12">
      <Outlet />
    </main>
    <BottomNav />
    {SHOW_ROLE_SWITCHER && <RoleSwitcher />}
  </div>
  );
};
