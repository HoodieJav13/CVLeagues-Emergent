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
import ScoreEntry from "./pages/ScoreEntry";

function App() {
  return (
    <AppStateProvider>
      <RoleProvider>
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
              <Route path="/score-entry" element={<ScoreEntry />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors />
      </RoleProvider>
    </AppStateProvider>
  );
}

export default App;
