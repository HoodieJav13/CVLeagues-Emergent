import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { RoleSwitcher } from "../RoleSwitcher";

// App shell: desktop top bar + mobile bottom nav + persistent role switcher.
export const AppLayout = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <TopBar />
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-5 pb-28 md:pb-12">
      <Outlet />
    </main>
    <BottomNav />
    <RoleSwitcher />
  </div>
);
