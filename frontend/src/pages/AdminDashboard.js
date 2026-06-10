import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Trophy, UsersThree, UserCircle, CalendarBlank, PencilSimpleLine, PaperPlaneTilt,
  Plus, Trash, PencilSimple, CheckCircle, Power, CalendarX,
  Gauge, ClipboardText, Signature, ChartBar,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { getTeam, getProfile, getLeague, computeTeamRecord, claimStats } from "../lib/selectors";
import { SPORTS, sportName } from "../lib/statsConfig";
import { SportBadge, StatusBadge } from "../components/common/Badges";
import { Avatar } from "../components/common/Avatar";
import { RoleGate } from "../components/layout/RoleGate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";

// FINAL DRAFT — Season 1 is admin-only (CLAUDE.md): players are profile
// records, NOT user accounts. Account-language features (claim/invite counts,
// resend invite, mark claimed, temp-admin score-keepers) are hidden behind
// this flag — kept dormant, not deleted — pending final-draft review.
const FINAL_DRAFT = false;

export default function AdminDashboard() {
  return (
    <RoleGate allow={["admin"]} title="Admin Dashboard">
      <Dashboard />
    </RoleGate>
  );
}

function Dashboard() {
  const app = useApp();
  const tabs = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "players", label: "Players", icon: UserCircle },
    { id: "registrations", label: "Registrations", icon: ClipboardText },
    { id: "agents", label: "Free Agents", icon: PaperPlaneTilt },
    { id: "waivers", label: "Waivers", icon: Signature },
    { id: "teams", label: "Teams", icon: UsersThree },
    { id: "leagues", label: "Leagues", icon: Trophy },
    { id: "games", label: "Schedule/Games", icon: CalendarBlank },
    { id: "scores", label: "Scores/Stats", icon: ChartBar },
  ];

  return (
    <div className="space-y-4 animate-fade-up">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold">CVF Operations</p>
          <h1 className="font-display font-extrabold uppercase tracking-tighter text-2xl text-white leading-none mt-1">Admin Console</h1>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-md px-2 py-1 whitespace-nowrap">Season 1 · Demo Data</span>
      </header>
      <Tabs defaultValue="overview">
        <TabsList className="bg-card border border-border w-full flex overflow-x-auto h-auto p-1 justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} data-testid={`admin-tab-${t.id}`} className="data-[state=active]:bg-primary data-[state=active]:text-black uppercase text-[11px] font-semibold whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5">
              <t.icon size={14} weight="bold" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-3"><OverviewTab /></TabsContent>
        <TabsContent value="players" className="mt-3"><PlayersTab app={app} /></TabsContent>
        <TabsContent value="registrations" className="mt-3"><RegistrationsTab app={app} /></TabsContent>
        <TabsContent value="agents" className="mt-3"><AgentsTab app={app} /></TabsContent>
        <TabsContent value="waivers" className="mt-3"><WaiversTab /></TabsContent>
        <TabsContent value="teams" className="mt-3"><TeamsTab app={app} /></TabsContent>
        <TabsContent value="leagues" className="mt-3"><LeaguesTab app={app} /></TabsContent>
        <TabsContent value="games" className="mt-3"><GamesTab app={app} /></TabsContent>
        <TabsContent value="scores" className="mt-3"><ScoresTab app={app} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- scaffold-only sections (Stage 1) ------------------- */
const SectionShell = ({ id, title, note }) => (
  <div data-testid={`admin-section-${id}`} className="bg-card border border-border rounded-xl p-4">
    <p className="font-display uppercase tracking-tight text-white">{title}</p>
    <p className="text-xs text-muted-foreground mt-1">{note}</p>
    <p className="text-[11px] text-muted-foreground/70 mt-3">Scaffold — tooling for this section ships in a later stage.</p>
  </div>
);
const OverviewTab = () => (
  <SectionShell id="overview" title="Overview" note="Operational summary: pending scores, new registrations, free agent intake, waiver verification queue." />
);
const WaiversTab = () => (
  <SectionShell id="waivers" title="Waivers" note="Waiver verification queue — append-only signed records, version history, eligibility review." />
);

/* ---------- shared row, table & button primitives ---------- */
const Row = ({ children, testid }) => (
  <div data-testid={testid} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3.5">{children}</div>
);
const IconBtn = ({ onClick, icon: Icon, testid, danger, title }) => (
  <button onClick={onClick} title={title} data-testid={testid} className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${danger ? "text-destructive" : "text-muted-foreground hover:text-white"}`}>
    <Icon size={16} weight="bold" />
  </button>
);
const AddBtn = ({ onClick, label, testid }) => (
  <button onClick={onClick} data-testid={testid} className="flex items-center gap-1.5 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-xs px-3.5 py-2 rounded-lg hover:bg-[#06b6d4] transition-colors">
    <Plus size={15} weight="bold" /> {label}
  </button>
);
// Disabled stand-in for actions that ship in a later stage.
const PlaceholderBtn = ({ icon: Icon, label, testid }) => (
  <button disabled title={`${label} — ships in a later stage`} aria-label={label} data-testid={testid} className="p-2 rounded-lg text-muted-foreground/30 cursor-not-allowed">
    <Icon size={16} weight="bold" />
  </button>
);

const SectionTitle = ({ title, count, action }) => (
  <div className="flex justify-between items-center gap-3">
    <p className="font-display uppercase tracking-tight text-white">
      {title} {count != null && <span className="text-sm text-muted-foreground font-sans normal-case tracking-normal">({count})</span>}
    </p>
    {action}
  </div>
);

const AdminTable = ({ head, children, testid }) => (
  <div data-testid={testid} className="bg-card border border-border rounded-xl overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          {head.map((h, i) => (
            <TableHead key={i} className="text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap h-9">{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  </div>
);
const EmptyRow = ({ colSpan, children }) => (
  <TableRow className="border-border hover:bg-transparent">
    <TableCell colSpan={colSpan} className="text-center text-xs text-muted-foreground py-8">{children}</TableCell>
  </TableRow>
);

const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/* ----------------------------- LEAGUES ----------------------------------- */
function LeaguesTab({ app }) {
  const { state, createEntity, updateEntity, deleteEntity, toggleRegistration } = app;
  const [modal, setModal] = useState(null); // {id?, name, sport, description}

  const save = () => {
    if (!modal.name?.trim() || !modal.sport) return toast.error("Name and sport required");
    if (modal.id) updateEntity("leagues", modal.id, { name: modal.name, sport: modal.sport, description: modal.description });
    else createEntity("leagues", { name: modal.name, sport: modal.sport, season: state.settings.currentSeason, description: modal.description || "" }, "l");
    toast.success(modal.id ? "League updated" : "League created");
    setModal(null);
  };

  const teamsIn = (leagueId) => state.teams.filter((t) => t.leagueId === leagueId);
  const playersIn = (leagueId) => {
    const teamIds = teamsIn(leagueId).map((t) => t.id);
    return new Set(state.teamPlayers.filter((tp) => teamIds.includes(tp.teamId)).map((tp) => tp.playerId)).size;
  };

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="font-display uppercase tracking-tight text-white mb-3">Registration Windows</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {SPORTS.map((s) => {
            const open = state.settings.registrationOpen[s.id];
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 bg-[#0f0f0f] border border-border rounded-lg p-3">
                <div className="flex items-center gap-2"><SportBadge sport={s.id} /><StatusBadge status={open ? "active" : "archived"} /></div>
                <button onClick={() => { toggleRegistration(s.id); toast.success(`${s.name} registration ${open ? "closed" : "opened"}`); }} data-testid={`admin-toggle-reg-${s.id}`} className={`flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1.5 rounded-lg ${open ? "text-destructive border border-destructive/40" : "text-primary border border-primary/40"}`}>
                  <Power size={14} weight="bold" /> {open ? "Close" : "Open"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <SectionTitle title="Leagues" count={state.leagues.length} action={<AddBtn onClick={() => setModal({ name: "", sport: "kickball", description: "" })} label="New League" testid="admin-add-league" />} />
      <AdminTable testid="admin-leagues-table" head={["League", "Sport", "Season", "Teams", "Players", "Status", ""]}>
        {state.leagues.length === 0 ? (
          <EmptyRow colSpan={7}>No leagues yet. Create one to start scheduling.</EmptyRow>
        ) : state.leagues.map((l) => (
          <TableRow key={l.id} data-testid={`admin-league-${l.id}`} className="border-border">
            <TableCell className="whitespace-nowrap">
              <div className="flex items-center gap-2">
                <Trophy size={16} weight="duotone" className="text-primary shrink-0" />
                <span className="font-medium text-white">{l.name}</span>
              </div>
            </TableCell>
            <TableCell><SportBadge sport={l.sport} /></TableCell>
            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{l.season}</TableCell>
            <TableCell className="text-xs text-white text-center">{teamsIn(l.id).length}</TableCell>
            <TableCell className="text-xs text-white text-center">{playersIn(l.id)}</TableCell>
            <TableCell><StatusBadge status={l.status || "active"} /></TableCell>
            <TableCell>
              <div className="flex items-center justify-end">
                <IconBtn onClick={() => setModal({ id: l.id, name: l.name, sport: l.sport, description: l.description })} icon={PencilSimple} title="Edit league" testid={`admin-edit-league-${l.id}`} />
                <IconBtn onClick={() => { deleteEntity("leagues", l.id); toast.success("League deleted"); }} icon={Trash} title="Delete league" testid={`admin-delete-league-${l.id}`} danger />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </AdminTable>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Edit League" : "New League"} onSave={save}>
        {modal && (
          <>
            <ModalField label="Name"><Input data-testid="admin-league-name" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
            <ModalField label="Sport">
              <Select value={modal.sport} onValueChange={(v) => setModal({ ...modal, sport: v })}>
                <SelectTrigger className="bg-[#0f0f0f] border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{SPORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </ModalField>
            <ModalField label="Description"><Textarea value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ TEAMS ------------------------------------ */
function TeamsTab({ app }) {
  const { state, createEntity, updateEntity, deleteEntity } = app;
  const [modal, setModal] = useState(null);

  const save = () => {
    if (!modal.name?.trim() || !modal.sport || !modal.leagueId) return toast.error("Name, sport & league required");
    const data = { name: modal.name, sport: modal.sport, leagueId: modal.leagueId, captainId: modal.captainId || null, logoColor: modal.logoColor || "#22d3ee", founded: modal.founded || "2026" };
    if (modal.id) updateEntity("teams", modal.id, data);
    else createEntity("teams", data, "t");
    toast.success(modal.id ? "Team updated" : "Team created");
    setModal(null);
  };

  const leaguesForSport = state.leagues.filter((l) => !modal?.sport || l.sport === modal.sport);
  const rosterCount = (teamId) => state.teamPlayers.filter((tp) => tp.teamId === teamId).length;

  return (
    <div className="space-y-3">
      <SectionTitle title="Teams" count={state.teams.length} action={<AddBtn onClick={() => setModal({ name: "", sport: "kickball", leagueId: "", captainId: "", logoColor: "#22d3ee", founded: "2026" })} label="New Team" testid="admin-add-team" />} />
      <AdminTable testid="admin-teams-table" head={["Team", "Sport", "League / Season", "Captain", "Roster", "Waivers", "Status", ""]}>
        {state.teams.length === 0 ? (
          <EmptyRow colSpan={8}>No teams yet. Approve a registration or create one directly.</EmptyRow>
        ) : state.teams.map((t) => {
          const league = getLeague(state, t.leagueId);
          const captain = getProfile(state, t.captainId);
          const rec = computeTeamRecord(state, t.id);
          return (
            <TableRow key={t.id} data-testid={`admin-team-${t.id}`} className="border-border">
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.logoColor }} />
                  <Link to={`/team/${t.id}`} className="font-medium text-white hover:text-primary">{t.name}</Link>
                  <span className="text-[11px] text-muted-foreground">{rec.wins}-{rec.losses}</span>
                </div>
              </TableCell>
              <TableCell><SportBadge sport={t.sport} /></TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{league ? `${league.name} · ${league.season}` : "—"}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {captain ? (<><span className="text-white">{captain.name}</span><span className="text-muted-foreground"> · {captain.phone}</span></>) : <span className="text-muted-foreground/60">—</span>}
              </TableCell>
              <TableCell className="text-xs text-white text-center">{rosterCount(t.id)}</TableCell>
              {/* Waiver/eligibility summary is a placeholder until waiver records exist (later stage). */}
              <TableCell className="text-xs text-muted-foreground/60">—</TableCell>
              <TableCell><StatusBadge status={t.status || "active"} /></TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <IconBtn onClick={() => setModal({ id: t.id, name: t.name, sport: t.sport, leagueId: t.leagueId, captainId: t.captainId, logoColor: t.logoColor, founded: t.founded })} icon={PencilSimple} title="Edit team" testid={`admin-edit-team-${t.id}`} />
                  <IconBtn onClick={() => { deleteEntity("teams", t.id); toast.success("Team deleted"); }} icon={Trash} title="Delete team" testid={`admin-delete-team-${t.id}`} danger />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </AdminTable>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Edit Team" : "New Team"} onSave={save}>
        {modal && (
          <>
            <ModalField label="Team Name"><Input data-testid="admin-team-name" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
            <ModalField label="Sport">
              <Select value={modal.sport} onValueChange={(v) => setModal({ ...modal, sport: v, leagueId: "" })}>
                <SelectTrigger className="bg-[#0f0f0f] border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{SPORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </ModalField>
            <ModalField label="League">
              <Select value={modal.leagueId} onValueChange={(v) => setModal({ ...modal, leagueId: v })}>
                <SelectTrigger className="bg-[#0f0f0f] border-border"><SelectValue placeholder="Select league" /></SelectTrigger>
                <SelectContent>{leaguesForSport.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </ModalField>
            <ModalField label="Captain">
              <Select value={modal.captainId || ""} onValueChange={(v) => setModal({ ...modal, captainId: v })}>
                <SelectTrigger className="bg-[#0f0f0f] border-border"><SelectValue placeholder="Select captain" /></SelectTrigger>
                <SelectContent>{state.profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </ModalField>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ----------------------------- PLAYERS ----------------------------------- */
function PlayersTab({ app }) {
  const { state, updateEntity, resendInvite } = app;
  const [modal, setModal] = useState(null); // {id, email, phone, adminNotes}
  const counts = claimStats(state);

  const teamsFor = (playerId) => {
    const ids = state.teamPlayers.filter((tp) => tp.playerId === playerId).map((tp) => tp.teamId);
    return state.teams.filter((t) => ids.includes(t.id));
  };

  const save = () => {
    updateEntity("profiles", modal.id, { email: modal.email, phone: modal.phone, adminNotes: modal.adminNotes });
    toast.success("Player record updated");
    setModal(null);
  };

  return (
    <div className="space-y-3">
      {/* FINAL DRAFT: claimed/unclaimed counts are account metrics — Season 1
          has no player accounts, so these stay hidden until final-draft review. */}
      {FINAL_DRAFT && (
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Total", value: counts.total, c: "text-white" }, { label: "Claimed", value: counts.claimed, c: "text-[#10b981]" }, { label: "Unclaimed", value: counts.unclaimed, c: "text-[#facc15]" }].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={`font-mono-score text-2xl font-bold ${s.c}`}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <SectionTitle title="Player Records" count={state.profiles.length} />
      <AdminTable testid="admin-players-table" head={["Player", "Email", "Phone", "Sports", "Team(s)", "Season", "Waiver", "Eligibility", "Notes", ""]}>
        {state.profiles.length === 0 ? (
          <EmptyRow colSpan={10}>No player records yet. Profiles are added by the admin or via intake forms.</EmptyRow>
        ) : state.profiles.map((p) => {
          const pTeams = teamsFor(p.id);
          return (
            <TableRow key={p.id} data-testid={`admin-player-${p.id}`} className="border-border">
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Avatar name={p.name} color={p.avatarColor} size={26} />
                  <Link to={`/profile/${p.id}`} className="font-medium text-white hover:text-primary">{p.name}</Link>
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{p.email}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{p.phone}</TableCell>
              <TableCell><div className="flex gap-1">{p.sports.map((s) => <SportBadge key={s} sport={s} />)}</div></TableCell>
              <TableCell className="text-xs text-white whitespace-nowrap">{pTeams.length ? pTeams.map((t) => t.name).join(", ") : <span className="text-muted-foreground/60">Unassigned</span>}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{state.settings.currentSeason}</TableCell>
              {/* Waiver & eligibility are placeholder fields until waiver records exist (later stage). */}
              <TableCell className="text-xs text-muted-foreground/60">{p.waiverStatus || "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground/60">{p.eligibilityStatus || "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{p.adminNotes || "—"}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end whitespace-nowrap">
                  <IconBtn onClick={() => setModal({ id: p.id, email: p.email, phone: p.phone, adminNotes: p.adminNotes || "" })} icon={PencilSimple} title="Edit player record" testid={`admin-edit-player-${p.id}`} />
                  {/* FINAL DRAFT: resend-invite / mark-claimed are account features — no player accounts in Season 1. */}
                  {FINAL_DRAFT && !p.claimed && (
                    <button onClick={() => { resendInvite(p.id); toast.success(`Invite resent to ${p.name}`); }} data-testid={`admin-resend-${p.id}`} className="flex items-center gap-1 text-xs font-semibold text-primary border border-primary/40 rounded-lg px-2.5 py-1.5">
                      <PaperPlaneTilt size={13} weight="bold" /> Resend
                    </button>
                  )}
                  {FINAL_DRAFT && (
                    <button onClick={() => updateEntity("profiles", p.id, { claimed: !p.claimed })} data-testid={`admin-toggle-claim-${p.id}`} className="text-xs text-muted-foreground hover:text-white px-2">
                      {p.claimed ? "Unclaim" : "Mark claimed"}
                    </button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </AdminTable>

      <Modal open={!!modal} onClose={() => setModal(null)} title="Edit Player Record" onSave={save}>
        {modal && (
          <>
            <ModalField label="Email"><Input data-testid="admin-player-email" value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
            <ModalField label="Phone"><Input data-testid="admin-player-phone" value={modal.phone} onChange={(e) => setModal({ ...modal, phone: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
            <ModalField label="Admin Notes"><Textarea data-testid="admin-player-notes" value={modal.adminNotes} onChange={(e) => setModal({ ...modal, adminNotes: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
          </>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------- REGISTRATIONS -------------------------------- */
// Team Interest submissions. Status vocabulary per CLAUDE.md:
// new / contacted / approved / archived.
// FINAL DRAFT: approving should eventually auto-create the team record —
// for Season 1, approval is a status change only (review at final draft).
function RegistrationsTab({ app }) {
  const { state, updateRegistrationStatus } = app;
  const regs = state.registrations;
  const newCount = regs.filter((r) => r.status === "new").length;

  return (
    <div className="space-y-3">
      <SectionTitle title="Team Registrations" count={`${newCount} new of ${regs.length}`} />
      {regs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
          No team registrations yet. Team Interest submissions land here for triage.
        </div>
      ) : regs.map((r) => (
        <Row key={r.id} testid={`admin-registration-${r.id}`}>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{r.teamName}</p>
            <p className="text-xs text-muted-foreground truncate">{r.captainName} · {r.captainEmail || r.captainPhone} · submitted {r.submittedDate}</p>
          </div>
          <SportBadge sport={r.sport} />
          <StatusBadge status={r.status} />
          <Select value={r.status} onValueChange={(v) => { updateRegistrationStatus(r.id, v); toast.success("Registration status updated"); }}>
            <SelectTrigger data-testid={`admin-reg-status-${r.id}`} className="bg-[#0f0f0f] border-border h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      ))}
    </div>
  );
}

/* -------------------------- SCHEDULE / GAMES ------------------------------ */
function GamesTab({ app }) {
  const { state, assignTempAdmin, updateEntity } = app;
  const [modal, setModal] = useState(null); // {id, date, time, location}

  const save = () => {
    if (!modal.date || !modal.time?.trim()) return toast.error("Date and time required");
    updateEntity("games", modal.id, { date: modal.date, time: modal.time, location: modal.location });
    toast.success("Game updated");
    setModal(null);
  };

  return (
    <div className="space-y-3">
      <SectionTitle title="Schedule / Games" count={state.games.length} />
      <AdminTable testid="admin-games-table" head={["Date / Time", "Sport", "League", "Matchup", "Location", "Status", "Score", "Actions"]}>
        {state.games.length === 0 ? (
          <EmptyRow colSpan={8}>No games scheduled yet.</EmptyRow>
        ) : state.games.map((g) => {
          const a = getTeam(state, g.awayTeamId), h = getTeam(state, g.homeTeamId);
          const league = getLeague(state, g.leagueId);
          return (
            <TableRow key={g.id} data-testid={`admin-game-${g.id}`} className="border-border">
              <TableCell className="text-xs text-white whitespace-nowrap">{fmtDate(g.date)} · {g.time}</TableCell>
              <TableCell><SportBadge sport={g.sport} /></TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{league ? `${league.name} · ${league.season}` : "—"}</TableCell>
              <TableCell className="whitespace-nowrap"><Link to={`/game/${g.id}`} className="text-white font-medium hover:text-primary">{a.name} @ {h.name}</Link></TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{g.location}</TableCell>
              <TableCell><StatusBadge status={g.status} /></TableCell>
              <TableCell><StatusBadge status={g.score_status || "pending"} /></TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                  <IconBtn onClick={() => setModal({ id: g.id, date: g.date, time: g.time, location: g.location })} icon={PencilSimple} title="Edit game" testid={`admin-edit-game-${g.id}`} />
                  <Link to="/score-entry" state={{ gameId: g.id }} title="Enter score" data-testid={`admin-game-enter-score-${g.id}`} className="p-2 rounded-lg text-primary hover:bg-white/10 transition-colors inline-flex">
                    <PencilSimpleLine size={16} weight="bold" />
                  </Link>
                  <PlaceholderBtn icon={CheckCircle} label="Mark Final" testid={`admin-mark-final-${g.id}`} />
                  <PlaceholderBtn icon={CalendarX} label="Postpone / Cancel" testid={`admin-postpone-${g.id}`} />
                  {/* FINAL DRAFT: temp-admin score-keepers are non-admin logins —
                      out of scope for admin-only Season 1, hidden until review. */}
                  {FINAL_DRAFT && (
                    <Select value={g.tempAdminId || "none"} onValueChange={(v) => { assignTempAdmin(g.id, v === "none" ? null : v); toast.success(v === "none" ? "Temp admin cleared" : "Temp admin assigned"); }}>
                      <SelectTrigger data-testid={`admin-tempadmin-${g.id}`} className="bg-[#0f0f0f] border-border h-9 w-36 text-xs"><SelectValue placeholder="Temp admin" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No temp admin</SelectItem>
                        {state.profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </AdminTable>
      <p className="text-[11px] text-muted-foreground">Actions: edit game · enter score · mark final (later stage) · postpone/cancel (later stage).</p>

      <Modal open={!!modal} onClose={() => setModal(null)} title="Edit Game" onSave={save}>
        {modal && (
          <>
            <ModalField label="Date"><Input type="date" data-testid="admin-game-date" value={modal.date} onChange={(e) => setModal({ ...modal, date: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
            <ModalField label="Time"><Input data-testid="admin-game-time" value={modal.time} onChange={(e) => setModal({ ...modal, time: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
            <ModalField label="Location"><Input data-testid="admin-game-location" value={modal.location} onChange={(e) => setModal({ ...modal, location: e.target.value })} className="bg-[#0f0f0f] border-border" /></ModalField>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ SCORES ----------------------------------- */
function ScoresTab({ app }) {
  const { state } = app;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-1">Enter or edit final scores. Updates standings, records, stats & leaderboards instantly.</p>
      {state.games.map((g) => {
        const a = getTeam(state, g.awayTeamId), h = getTeam(state, g.homeTeamId);
        const done = g.status === "completed";
        return (
          <Row key={g.id} testid={`admin-score-${g.id}`}>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{a.name} @ {h.name}</p>
              <p className="text-xs text-muted-foreground">{done ? `Final · ${g.awayScore}-${g.homeScore}` : "Not played"}</p>
            </div>
            <SportBadge sport={g.sport} />
            <Link to="/score-entry" state={{ gameId: g.id }} data-testid={`admin-enter-score-${g.id}`} className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary border border-primary/40 rounded-lg px-3 py-2">
              <PencilSimpleLine size={14} weight="bold" /> {done ? "Edit" : "Enter"}
            </Link>
          </Row>
        );
      })}
    </div>
  );
}

/* ---------------------------- FREE AGENTS -------------------------------- */
// Intake triage. Status vocabulary per CLAUDE.md: new / contacted / assigned / archived.
function AgentsTab({ app }) {
  const { state, setFreeAgentStatus } = app;
  return (
    <div className="space-y-2">
      {state.freeAgents.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
          No free agent submissions yet. Free Agent intake lands here for triage.
        </div>
      )}
      {state.freeAgents.map((a) => (
        <Row key={a.id} testid={`admin-agent-${a.id}`}>
          <Avatar name={a.name} color="#22d3ee" size={36} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{a.name}</p>
            <p className="text-xs text-muted-foreground truncate">{a.experience} · {a.sports.map(sportName).join(", ")}</p>
          </div>
          <StatusBadge status={a.status} />
          <Select value={a.status} onValueChange={(v) => { setFreeAgentStatus(a.id, v); toast.success("Status updated"); }}>
            <SelectTrigger data-testid={`admin-agent-status-${a.id}`} className="bg-[#0f0f0f] border-border h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      ))}
    </div>
  );
}

/* ------------------------------ modal ------------------------------------ */
const Modal = ({ open, onClose, title, onSave, children }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="bg-card border-border" data-testid="admin-modal">
      <DialogHeader><DialogTitle className="font-display uppercase tracking-tight text-white">{title}</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">{children}</div>
      <DialogFooter>
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-white">Cancel</button>
        <button onClick={onSave} data-testid="admin-modal-save" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold uppercase text-sm">Save</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
const ModalField = ({ label, children }) => (
  <div>
    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 block">{label}</Label>
    {children}
  </div>
);
