import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BASE_TITLE = "CVF Sports | Adult Rec Leagues";

// Route-level titles keyed by the first path segment (dynamic segments share one label).
const SEGMENT_TITLES = {
  schedule: "Schedule",
  standings: "Standings",
  game: "Game",
  team: "Team",
  leaderboards: "Leaderboards",
  profile: "Player",
  "register-team": "Team Interest",
  "free-agent-signup": "Free Agent Signup",
  "free-agents": "Free Agents",
  admin: "Admin",
  "score-entry": "Score Entry",
};

export function useDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const segment = pathname.split("/")[1];
    const label = SEGMENT_TITLES[segment];
    document.title = label ? `${label} · CVF Sports` : BASE_TITLE;
  }, [pathname]);
}
