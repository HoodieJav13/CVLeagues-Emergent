import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AppStateProvider } from "./context/AppStateContext";
import { RoleProvider } from "./context/RoleContext";
import { AppLayout } from "./components/layout/AppLayout";

import { lazy, Suspense } from "react";

import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Standings from "./pages/Standings";
import Playoffs from "./pages/Playoffs";
import GameDetail from "./pages/GameDetail";
import TeamPage from "./pages/TeamPage";
import Leaderboards from "./pages/Leaderboards";
import AthleteProfile from "./pages/AthleteProfile";
import TeamRegistration from "./pages/TeamRegistration";
import FreeAgentSignup from "./pages/FreeAgentSignup";
import FreeAgentPool from "./pages/FreeAgentPool";
import NotFound from "./pages/NotFound";
import { CONFIG_ERROR } from "./lib/supabase";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

// The admin surfaces load on demand. A spectator checking a score on field
// wifi has no reason to download the dashboard, scorekeepers, bracket engine,
// payments ledger, and Hall of Fame curation — which together are most of the
// bundle. Public pages stay eager: they are the product and must not flash a
// loading state on first paint.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminRecovery = lazy(() => import("./pages/AdminRecovery"));
const AdminResetPassword = lazy(() => import("./pages/AdminResetPassword"));
const AdminSecurity = lazy(() => import("./pages/AdminSecurity"));
const ScoreEntry = lazy(() => import("./pages/ScoreEntry"));

// Route-level fallback for the lazy admin chunk while it fetches. Sized to
// hold the page area so the layout does not jump.
const RouteLoading = () => (
  <div className="min-h-[50vh] flex items-center justify-center" aria-busy="true">
    <p className="text-micro uppercase tracking-widest text-muted-foreground font-semibold">Loading…</p>
  </div>
);

function App() {
  if (CONFIG_ERROR) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg bg-card border border-destructive/50 rounded-2xl p-8 text-center">
          <h1 className="font-display uppercase text-heading text-foreground">Configuration Required</h1>
          <p className="text-sm text-muted-foreground mt-2">{CONFIG_ERROR}</p>
          <p className="text-xs text-muted-foreground mt-4">No mock or local data has been loaded.</p>
        </div>
      </main>
    );
  }
  return (
    <ErrorBoundary>
    <RoleProvider>
      <AppStateProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/standings" element={<Standings />} />
              <Route path="/playoffs" element={<Playoffs />} />
              <Route path="/game/:id" element={<GameDetail />} />
              <Route path="/team/:id" element={<TeamPage />} />
              <Route path="/leaderboards" element={<Leaderboards />} />
              <Route path="/profile/:id" element={<AthleteProfile />} />
              <Route path="/register-team" element={<TeamRegistration />} />
              <Route path="/free-agent-signup" element={<FreeAgentSignup />} />
              <Route path="/free-agents" element={<FreeAgentPool />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/recover" element={<AdminRecovery />} />
              <Route path="/admin/reset-password" element={<AdminResetPassword />} />
              <Route path="/admin/security" element={<AdminSecurity />} />
              <Route path="/score-entry" element={<ScoreEntry />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors />
      </AppStateProvider>
    </RoleProvider>
    </ErrorBoundary>
  );
}

export default App;
