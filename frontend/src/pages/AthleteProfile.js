import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CalendarX, ShareNetwork, Lock, Trophy, UserCircle, UsersThree } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import {
  getProfile, playerSports, playerTeams, playerSeasonStats, playerCareerStats, playerGameLog, getTeam, currentSeasonForSport,
  seasonsForSport, playerGamesPlayed, playerRankContext, hasCareerBaseline,
} from "../lib/selectors";
import { HIGHLIGHT_STATS, statLabel, sportName, LEADERBOARD_CATEGORIES, DERIVED_STATS, computeDerivedStat, formatDerivedStat } from "../lib/statsConfig";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { formatGameShortDate } from "../lib/gameTime";
import { StructuralIdentityBadge } from "../components/direction/StructuralIdentity";
import { SportBadge } from "../components/common/Badges";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { ComingSoon } from "../components/common/ComingSoon";
import { EmptyState } from "../components/common/Section";
import { Card, CardContent } from "../components/ui/card";

export default function AthleteProfile() {
  const { id } = useParams();
  const { state } = useApp();
  const { role, roleMeta } = useRole();

  // Resolve "me" to the demo role's bound profile.
  const targetId = id === "me" ? roleMeta.profile_id : id;
  const profile = targetId ? getProfile(state, targetId) : null;

  if (!profile) {
    return <EmptyState icon={UserCircle} title="No profile available" message={id === "me" ? "Switch to the Player or Captain demo role to view a personal profile." : "This athlete could not be found."} className="bg-card border border-border rounded-2xl max-w-md mx-auto mt-8" />;
  }

  // PRODUCTION RULE: private tab only for the profile owner or an admin.
  const isOwner = roleMeta.profile_id === profile.id;
  const canViewPrivate = role === "admin" || ((role === "player" || role === "captain") && isOwner);

  const sports = playerSports(state, profile.id);
  const teams = playerTeams(state, profile.id);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header banner */}
      <Card density="spacious" className="relative overflow-hidden rounded-2xl" style={{ background: `linear-gradient(135deg, ${profile.avatar_color}22, transparent)` }}>
        <CardContent className="p-[var(--card-spacing)]">
        <div className="flex items-center gap-4">
          <StructuralIdentityBadge color={profile.avatar_color} name={profile.name} />
          <div className="min-w-0">
            <h1 className="font-display uppercase text-display-xl text-foreground">{profile.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {sports.map((s) => <SportBadge key={s} sport={s} />)}
              <span className="text-xs text-muted-foreground">{profile.experience}</span>
            </div>
          </div>
        </div>
        {profile.bio && <p className="text-sm text-muted-foreground mt-4 max-w-lg">{profile.bio}</p>}
        </CardContent>
      </Card>

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
            <Button
              variant="ghost"
              data-testid="profile-share"
              onClick={() => shareProfile(profile)}
              className="h-auto p-0 gap-1.5 normal-case tracking-normal text-sm font-normal text-muted-foreground hover:text-primary hover:bg-transparent"
            >
              <ShareNetwork size={15} weight="bold" /> Share profile
            </Button>
          </div>
          <SportTabs sports={sports} testid="profile-public-sport" render={(sport) => (
            <PublicSport state={state} profile={profile} sport={sport} />
          )} />
          <TeamHistory teams={teams} />
        </TabsContent>

        {/* ---------------- PRIVATE ---------------- */}
        <TabsContent value="private" className="space-y-6 mt-4" data-testid="profile-private-content">
          {canViewPrivate ? (
            <>
              <PrivateDetails profile={profile} />
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
  <Card density="default" className="rounded-2xl">
    <CardContent className="p-[var(--card-spacing)]">
    <h3 className="font-display uppercase tracking-tight text-foreground mb-3">Team History</h3>
    {teams.length ? <div className="space-y-2">
      {teams.map((t) => (
        <Link key={t.id} to={`/team/${t.team.id}`} className="flex items-center justify-between gap-3 min-h-11 p-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <StructuralIdentityBadge className="cvf-identity-badge--sm" team={t.team} />
            <span className="font-medium text-foreground truncate">{t.team.name}</span>
            <SportBadge sport={t.team.sport} />
          </div>
          <span className="text-xs font-mono-score text-muted-foreground">#{t.jersey_number} · {t.record.wins}-{t.record.losses}</span>
        </Link>
      ))}
    </div> : <EmptyState icon={UsersThree} title="No team history" message="Team assignments appear here." density="compact" />}
    </CardContent>
  </Card>
);

// Share uses the Web Share sheet where it exists and falls back to the
// clipboard, so the control always does something on every browser.
async function shareProfile(profile) {
  const url = `${window.location.origin}/profile/${profile.id}`;
  const payload = { title: profile.name, text: `${profile.name} on CVF Leagues`, url };
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Profile link copied");
  } catch (error) {
    // A user dismissing the native share sheet is not a failure worth shouting about.
    if (error?.name === "AbortError") return;
    toast.error("Could not share this profile");
  }
}

// A career RATE is unknowable once an imported baseline contributed, because
// the baseline and the granular games are different domains: seed p1 draws 53
// of 60 career hits from a baseline that records no kicks at all, so the
// resulting "kick average" of 6.000 is not a high number, it is a meaningless
// one. No qualifier threshold rescues this — career kicks is exactly 10, so
// `meetsQualifier` returns true and publishes it anyway.
//
// THE ASYMMETRY IS DELIBERATE — do not collapse these two columns into one
// rule. The season column is entirely granular, so its ratios are sound and
// keep rendering. Only the career column declines.
//
// Counting formats stay in both columns: a sum across a mixed career is still
// a correct sum. The test is "is this a rate", not an allowlist of two format
// names, so a rate format added later declines by default instead of silently
// slipping through.
const careerRateIsUnknowable = (stat, careerHasBaseline) =>
  careerHasBaseline && stat.format !== "count";

// Full public statistics: season selector, highlight tiles with league rank,
// season-vs-career table including derived rate stats, and the game log. This
// is deliberately public — it is the thing a player sends to someone else.
const PublicSport = ({ state, profile, sport }) => {
  const seasons = seasonsForSport(state, sport);
  const [season, setSeason] = useState(() => currentSeasonForSport(state, sport));

  const seasonTotals = playerSeasonStats(state, profile.id, sport, season);
  const career = playerCareerStats(state, profile.id, sport);
  const log = playerGameLog(state, profile.id, sport, { season });
  const gamesPlayed = playerGamesPlayed(state, profile.id, sport, { season });
  const keys = LEADERBOARD_CATEGORIES[sport].map((c) => c.key);
  const derived = DERIVED_STATS[sport] || [];
  const careerHasBaseline = hasCareerBaseline(state, profile.id, sport);
  const empty = !hasAnyStat(seasonTotals) && !hasAnyStat(career) && log.length === 0;

  return (
    <Card density="default" className="rounded-2xl">
      <CardContent className="p-[var(--card-spacing)]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <SportBadge sport={sport} />
          <span className="text-xs text-muted-foreground uppercase">Statistics</span>
        </div>
        {seasons.length > 1 && (
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger data-testid={`profile-season-${sport}`} className="bg-card border-border h-9 w-auto min-w-[9rem] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {empty ? (
        <EmptyState icon={Trophy} title="No stats yet" message="Statistics appear after completed games are recorded." density="compact" className="py-4" data-testid="profile-public-nostats" />
      ) : (
      <>
      {/* highlight tiles, each carrying its league rank for this season */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {HIGHLIGHT_STATS[sport].map((key) => {
          const rank = playerRankContext(state, profile.id, sport, key, "season", season);
          return (
            <Card key={key} density="compact" className="bg-surface/60 text-center">
              <CardContent className="p-[var(--card-spacing)]">
                <p className="font-mono-score text-2xl font-bold text-primary leading-none">{seasonTotals[key] || 0}</p>
                <p className="text-micro uppercase tracking-widest text-muted-foreground mt-1">{statLabel(sport, key)}</p>
                {rank && (
                  <p className="text-micro uppercase tracking-widest text-muted-foreground mt-1" data-testid={`profile-rank-${key}`}>
                    {rank.rankLabel} of {rank.fieldSize}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* season vs career table */}
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-micro uppercase tracking-widest">
              <th className="text-left font-semibold py-2">Stat</th>
              <th className="text-right font-semibold py-2 px-3">{season}</th>
              <th className="text-right font-semibold py-2">League Career</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="py-2 text-foreground">Games Played</td>
              <td className="py-2 px-3 text-right font-mono-score text-primary">{gamesPlayed ?? "—"}</td>
              <td className="py-2 text-right font-mono-score text-muted-foreground">
                {playerGamesPlayed(state, profile.id, sport) ?? "—"}
              </td>
            </tr>
            {keys.map((k) => (
              <tr key={k} className="border-t border-border">
                <td className="py-2 text-foreground">{statLabel(sport, k)}</td>
                <td className="py-2 px-3 text-right font-mono-score text-primary">{seasonTotals[k] || 0}</td>
                <td className="py-2 text-right font-mono-score text-muted-foreground">{career[k] || 0}</td>
              </tr>
            ))}
            {derived.map((stat) => (
              <tr key={stat.key} className="border-t border-border">
                <td className="py-2 text-muted-foreground italic">{stat.label}</td>
                <td className="py-2 px-3 text-right font-mono-score text-primary">
                  {formatDerivedStat(sport, stat.key, computeDerivedStat(sport, stat.key, seasonTotals, { gamesPlayed }))}
                </td>
                <td className="py-2 text-right font-mono-score text-muted-foreground">
                  {careerRateIsUnknowable(stat, careerHasBaseline)
                    ? "—"
                    : formatDerivedStat(sport, stat.key, computeDerivedStat(sport, stat.key, career, { gamesPlayed: playerGamesPlayed(state, profile.id, sport) }))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* game log */}
      <p className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-2">{season} League Game Log</p>
      <div className="space-y-1.5">
        {log.length ? log.map((row) => {
          const opp = getTeam(state, row.game.home_team_id === row.team_id ? row.game.away_team_id : row.game.home_team_id);
          return (
            <Link key={row.id} to={`/game/${row.game.id}`} className="flex items-center justify-between gap-2 min-h-11 text-sm p-2 rounded-lg hover:bg-white/5 active:bg-white/10">
              <span className="text-muted-foreground">{formatGameShortDate(row.game)} <span className="text-muted-foreground">vs {opp?.name}</span></span>
              <span className="font-mono-score text-xs text-primary">{keys.slice(0, 3).map((k) => `${row.stats[k] || 0} ${statLabel(sport, k).split(" ")[0]}`).join(" · ")}</span>
            </Link>
          );
        }) : <EmptyState icon={CalendarX} title="No games logged" message="Completed games appear here." density="compact" />}
      </div>
      </>
      )}
      </CardContent>
    </Card>
  );
};

// The private tab now holds what is genuinely private — contact and emergency
// details. In hosted mode anonymous readers get `public_profiles`, which has no
// contact columns at all, so these simply render as not recorded.
const PrivateDetails = ({ profile }) => {
  const rows = [
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone },
    { label: "Experience", value: profile.experience },
    { label: "Emergency Contact", value: profile.emergency_contact_name },
    { label: "Emergency Phone", value: profile.emergency_contact_phone },
  ];
  return (
    <Card density="default" className="rounded-2xl" data-testid="profile-private-details">
      <CardContent className="p-[var(--card-spacing)]">
        <h3 className="font-display uppercase tracking-tight text-foreground mb-3">Contact &amp; Emergency</h3>
        <dl className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 border-t border-border pt-2 first:border-0 first:pt-0">
              <dt className="text-micro uppercase tracking-widest text-muted-foreground">{row.label}</dt>
              <dd className="text-sm text-foreground text-right break-words">{row.value || "Not recorded"}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
};
