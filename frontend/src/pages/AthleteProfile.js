import { useParams, Link } from "react-router-dom";
import { ShareNetwork, Lock, Trophy } from "@phosphor-icons/react";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import {
  getProfile, playerSports, playerTeams, playerSeasonStats, playerCareerStats, playerGameLog, getTeam,
} from "../lib/selectors";
import { HIGHLIGHT_STATS, statLabel, sportName, LEADERBOARD_CATEGORIES } from "../lib/statsConfig";
import { Avatar } from "../components/common/Avatar";
import { SportBadge } from "../components/common/Badges";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { ComingSoon } from "../components/common/ComingSoon";

export default function AthleteProfile() {
  const { id } = useParams();
  const { state } = useApp();
  const { role, roleMeta } = useRole();

  // Resolve "me" to the demo role's bound profile.
  const targetId = id === "me" ? roleMeta.profile_id : id;
  const profile = targetId ? getProfile(state, targetId) : null;

  if (!profile) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-md mx-auto mt-8">
        <p className="font-display uppercase text-foreground text-lg">No profile available</p>
        <p className="text-sm text-muted-foreground mt-1">
          {id === "me" ? "Switch to the Player or Captain demo role to view a personal profile." : "This athlete could not be found."}
        </p>
      </div>
    );
  }

  // PRODUCTION RULE: private tab only for the profile owner or an admin.
  const isOwner = roleMeta.profile_id === profile.id;
  const canViewPrivate = role === "admin" || ((role === "player" || role === "captain") && isOwner);

  const sports = playerSports(state, profile.id);
  const teams = playerTeams(state, profile.id);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border p-6" style={{ background: `linear-gradient(135deg, ${profile.avatar_color}22, transparent)` }}>
        <div className="flex items-center gap-4">
          <Avatar name={profile.name} color={profile.avatar_color} size={72} />
          <div className="min-w-0">
            <h1 className="font-display uppercase text-display-lg text-foreground">{profile.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {sports.map((s) => <SportBadge key={s} sport={s} />)}
              <span className="text-xs text-muted-foreground">{profile.experience}</span>
            </div>
          </div>
        </div>
        {profile.bio && <p className="text-sm text-muted-foreground mt-4 max-w-lg">{profile.bio}</p>}
      </div>

      <Tabs defaultValue="public">
        <TabsList className="bg-card border border-border w-full grid grid-cols-2 h-11">
          <TabsTrigger value="public" data-testid="profile-tab-public" className="data-[state=active]:bg-primary data-[state=active]:text-ink uppercase font-display tracking-tight">
            Public
          </TabsTrigger>
          <TabsTrigger value="private" disabled={!canViewPrivate} data-testid="profile-tab-private" className="data-[state=active]:bg-primary data-[state=active]:text-ink uppercase font-display tracking-tight">
            {!canViewPrivate && <Lock size={13} weight="bold" className="mr-1" />} Private
          </TabsTrigger>
        </TabsList>

        {/* ---------------- PUBLIC ---------------- */}
        <TabsContent value="public" className="space-y-6 mt-4" data-testid="profile-public-content">
          <div className="flex justify-end">
            <button data-testid="profile-share" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
              <ShareNetwork size={15} weight="bold" /> Share profile
            </button>
          </div>
          <SportTabs sports={sports} testid="profile-public-sport" render={(sport) => {
            const season = playerSeasonStats(state, profile.id, sport);
            return (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4"><SportBadge sport={sport} /><span className="text-xs text-muted-foreground uppercase">Season Highlights</span></div>
                {hasAnyStat(season) ? (
                  <div className="grid grid-cols-3 gap-3">
                    {HIGHLIGHT_STATS[sport].map((key) => (
                      <div key={key} className="text-center bg-[#0F1416]/60 rounded-xl p-3 border border-border">
                        <p className="font-mono-score text-2xl font-bold text-primary leading-none">{season[key] || 0}</p>
                        <p className="text-micro uppercase tracking-widest text-muted-foreground mt-1">{statLabel(sport, key)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="profile-public-nostats">No stats recorded yet for this season.</p>
                )}
              </div>
            );
          }} />
          <TeamHistory teams={teams} />
        </TabsContent>

        {/* ---------------- PRIVATE ---------------- */}
        <TabsContent value="private" className="space-y-6 mt-4" data-testid="profile-private-content">
          {canViewPrivate ? (
            <>
              <SportTabs sports={sports} testid="profile-private-sport" render={(sport) => (
                <PrivateSport state={state} profile={profile} sport={sport} />
              )} />
              <TeamHistory teams={teams} />
              <ComingSoon label="Photo Upload" />
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Private stats are only visible to the athlete and admins.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// True when a stat object has at least one non-zero value.
const hasAnyStat = (statsObj) => Object.values(statsObj || {}).some((v) => Number(v) > 0);

// Renders sport stats behind toggle tabs when a player has more than one sport;
// for a single sport it shows the content directly with no tabs. Structural only.
const SportTabs = ({ sports, render, testid }) => {
  if (!sports.length) return null;
  if (sports.length === 1) return <div data-testid={`${testid}-single`}>{render(sports[0])}</div>;
  return (
    <Tabs defaultValue={sports[0]}>
      <TabsList className="bg-card border border-border h-10">
        {sports.map((s) => (
          <TabsTrigger key={s} value={s} data-testid={`${testid}-${s}`} className="data-[state=active]:bg-secondary uppercase text-xs font-semibold tracking-wide">
            {sportName(s)}
          </TabsTrigger>
        ))}
      </TabsList>
      {sports.map((s) => (
        <TabsContent key={s} value={s} className="mt-4">{render(s)}</TabsContent>
      ))}
    </Tabs>
  );
};

const TeamHistory = ({ teams }) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <p className="font-display uppercase tracking-tight text-foreground mb-3">Team History</p>
    <div className="space-y-2">
      {teams.map((t) => (
        <Link key={t.id} to={`/team/${t.team.id}`} className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.team.logo_color }} />
            <span className="font-medium text-foreground truncate">{t.team.name}</span>
            <SportBadge sport={t.team.sport} />
          </div>
          <span className="text-xs font-mono-score text-muted-foreground">#{t.jersey_number} · {t.record.wins}-{t.record.losses}</span>
        </Link>
      ))}
    </div>
  </div>
);

const PrivateSport = ({ state, profile, sport }) => {
  const season = playerSeasonStats(state, profile.id, sport);
  const career = playerCareerStats(state, profile.id, sport);
  const log = playerGameLog(state, profile.id, sport);
  const keys = LEADERBOARD_CATEGORIES[sport].map((c) => c.key);
  const empty = !hasAnyStat(season) && !hasAnyStat(career) && log.length === 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4"><SportBadge sport={sport} /><span className="text-xs text-muted-foreground uppercase">Full Statistics</span></div>

      {empty ? (
        <p className="text-sm text-muted-foreground" data-testid="profile-private-nostats">No stats recorded yet for this season.</p>
      ) : (
      <>
      {/* season vs career table */}
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-micro uppercase tracking-widest">
              <th className="text-left font-semibold py-2">Stat</th>
              <th className="text-right font-semibold py-2 px-3">Season</th>
              <th className="text-right font-semibold py-2">Career</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-t border-border">
                <td className="py-2 text-foreground">{statLabel(sport, k)}</td>
                <td className="py-2 px-3 text-right font-mono-score text-primary">{season[k] || 0}</td>
                <td className="py-2 text-right font-mono-score text-muted-foreground">{career[k] || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* game log */}
      <p className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-2">Game Log</p>
      <div className="space-y-1.5">
        {log.length ? log.map((row) => {
          const opp = getTeam(state, row.game.home_team_id === row.team_id ? row.game.away_team_id : row.game.home_team_id);
          return (
            <Link key={row.id} to={`/game/${row.game.id}`} className="flex items-center justify-between gap-2 text-sm p-2 rounded-lg hover:bg-white/5">
              <span className="text-muted-foreground">{new Date(row.game.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} <span className="text-secondary">vs {opp?.name}</span></span>
              <span className="font-mono-score text-xs text-primary">{keys.slice(0, 3).map((k) => `${row.stats[k] || 0} ${statLabel(sport, k).split(" ")[0]}`).join(" · ")}</span>
            </Link>
          );
        }) : <p className="text-sm text-muted-foreground">No games logged.</p>}
      </div>
      </>
      )}
    </div>
  );
};
