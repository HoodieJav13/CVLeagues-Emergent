import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AppStateProvider } from "./context/AppStateContext";
import { RoleProvider } from "./context/RoleContext";
import { AppLayout } from "./components/layout/AppLayout";

import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Standings from "./pages/Standings";
import GameDetail from "./pages/GameDetail";
import TeamPage from "./pages/TeamPage";
import Leaderboards from "./pages/Leaderboards";
import AthleteProfile from "./pages/AthleteProfile";
import TeamRegistration from "./pages/TeamRegistration";
import FreeAgentSignup from "./pages/FreeAgentSignup";
import FreeAgentPool from "./pages/FreeAgentPool";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRecovery from "./pages/AdminRecovery";
import AdminResetPassword from "./pages/AdminResetPassword";
import AdminSecurity from "./pages/AdminSecurity";
import ScoreEntry from "./pages/ScoreEntry";
import NotFound from "./pages/NotFound";
import { CONFIG_ERROR } from "./lib/supabase";

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
    <RoleProvider>
      <AppStateProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/standings" element={<Standings />} />
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
        </BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors />
      </AppStateProvider>
    </RoleProvider>
  );
}

export default App;
