import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Trophy, UsersThree, UserCircle, CalendarBlank, PencilSimpleLine, PaperPlaneTilt,
  Plus, Trash, PencilSimple, CheckCircle, Power, CalendarX,
  Gauge, ClipboardText, Signature, ChartBar,
  Archive, NotePencil, Phone, LockSimple, LockSimpleOpen, ClockCounterClockwise, UserPlus,
  CaretRight, Flag, LinkSimple, X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { getTeam, getProfile, getLeague, computeTeamRecord, claimStats, teamRoster } from "../lib/selectors";
import { SPORTS, sportName } from "../lib/statsConfig";
import { freeAgentName } from "../lib/utils";
import { SportBadge, StatusBadge } from "../components/common/Badges";
import { Avatar } from "../components/common/Avatar";
import { EligibilityIndicator } from "../components/common/EligibilityIndicator";
import { Checkbox } from "../components/ui/checkbox";
import { RoleGate } from "../components/layout/RoleGate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from "../components/ui/alert-dialog";
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
  const [tab, setTab] = useState("overview"); // controlled so Overview cards can deep-link to sections
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
          <p className="text-micro uppercase tracking-[0.25em] text-primary font-bold">CVF Operations</p>
          <h1 className="font-display uppercase text-display-lg text-foreground mt-1">Admin Console</h1>
        </div>
        <span className="text-micro uppercase tracking-widest text-muted-foreground border border-border rounded-md px-2 py-1 whitespace-nowrap">Season 1 · Demo Data</span>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border w-full flex overflow-x-auto h-auto p-1 justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} data-testid={`admin-tab-${t.id}`} className="data-[state=active]:bg-primary data-[state=active]:text-ink uppercase text-micro font-semibold whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5">
              <t.icon size={14} weight="bold" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-3"><OverviewTab app={app} onNavigate={setTab} /></TabsContent>
        <TabsContent value="players" className="mt-3"><PlayersTab app={app} /></TabsContent>
        <TabsContent value="registrations" className="mt-3"><RegistrationsTab app={app} /></TabsContent>
        <TabsContent value="agents" className="mt-3"><AgentsTab app={app} /></TabsContent>
        <TabsContent value="waivers" className="mt-3"><WaiversTab app={app} /></TabsContent>
        <TabsContent value="teams" className="mt-3"><TeamsTab app={app} /></TabsContent>
        <TabsContent value="leagues" className="mt-3"><LeaguesTab app={app} /></TabsContent>
        <TabsContent value="games" className="mt-3"><GamesTab app={app} /></TabsContent>
        <TabsContent value="scores" className="mt-3"><ScoresTab app={app} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------ OVERVIEW ---------------------------------- */
// Operational queues, ordered by urgency. Counts derive from existing state.
const QueueCard = ({ count, title, desc, cta, onClick, testid, muted }) => (
  <div data-testid={testid} className="bg-card border border-border rounded-xl p-4 flex flex-col">
    <p className={`font-mono-score text-3xl font-bold ${muted || count === 0 ? "text-muted-foreground" : "text-primary"}`}>{count}</p>
    <p className="font-display uppercase tracking-tight text-foreground mt-1">{title}</p>
    <p className="text-xs text-muted-foreground mt-0.5 flex-1">{desc}</p>
    <button onClick={onClick} className="mt-3 self-start flex items-center gap-1 text-xs font-bold uppercase text-primary border border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors">
      {cta} <CaretRight size={12} weight="bold" />
    </button>
  </div>
);

function OverviewTab({ app, onNavigate }) {
  const { state } = app;
  const waivers = state.waivers || [];
  const scoresNeeded = state.games.filter((g) => g.score_status === "pending" || g.score_status === "submitted").length;
  const regsToTriage = state.registrations.filter((r) => r.status === "new" || r.status === "contacted").length;
  const agentsToReview = state.freeAgents.filter((a) => a.status === "new" || a.status === "contacted").length;
  // Placeholder until real waiver submissions exist: profiles with no waiver record linked.
  const missingWaivers = state.profiles.filter((p) => !waivers.some((w) => w.profile_id === p.id)).length;
  const lockedGames = state.games.filter((g) => g.locked).length;

  const cards = [
    { count: scoresNeeded, title: "Games Needing Scores", desc: "Enter, review and lock final scores. Pending have no score; submitted await Mark Final.", cta: "Scores/Stats", tab: "scores", testid: "admin-overview-scores" },
    { count: regsToTriage, title: "Registrations to Triage", desc: "Team interest submissions awaiting contact or approval.", cta: "Registrations", tab: "registrations", testid: "admin-overview-registrations" },
    { count: agentsToReview, title: "Free Agents to Review", desc: "Intake submissions awaiting contact or team assignment.", cta: "Free Agents", tab: "agents", testid: "admin-overview-agents" },
    { count: missingWaivers, title: "Players Missing Waivers", desc: "Profiles with no waiver record on file (mock count until the backend ships).", cta: "Waivers", tab: "waivers", testid: "admin-overview-waivers" },
    { count: lockedGames, title: "Locked / Final Games", desc: "Season games marked final and locked against edits.", cta: "Scores/Stats", tab: "scores", testid: "admin-overview-locked", muted: true },
    // FINAL DRAFT: duplicate-profile detection ships at final-draft review.
    // Hidden until then rather than showing a permanently-zero placeholder card.
    ...(FINAL_DRAFT ? [{ count: 0, title: "Possible Duplicate Profiles", desc: "Duplicate detection ships at final-draft review.", cta: "Players", tab: "players", testid: "admin-overview-duplicates", muted: true }] : []),
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((c) => (
        <QueueCard key={c.testid} count={c.count} title={c.title} desc={c.desc} cta={c.cta} onClick={() => onNavigate(c.tab)} testid={c.testid} muted={c.muted} />
      ))}
    </div>
  );
}

/* ------------------------------- WAIVERS ---------------------------------- */
// Mock waiver verification queue (real submission flow ships with the
// backend). Submitted ≠ eligible: eligibility = admin verification +
// team/season assignment. Records are append-only — re-signing adds a row.
function WaiversTab({ app }) {
  const { state, updateEntity } = app;
  const waivers = state.waivers || [];
  return (
    <div className="space-y-3">
      <div className="bg-card border border-primary/30 rounded-xl p-4">
        <p className="font-display uppercase tracking-tight text-foreground">Waiver Verification Queue</p>
        <p className="text-xs text-muted-foreground mt-1">
          Waiver submission flow ships with the backend — these are mock records. Records are append-only: re-signing creates a new row.
          A submitted waiver does <span className="text-foreground font-semibold">not</span> equal eligibility — eligibility requires admin verification plus team/season assignment.
        </p>
      </div>
      <SectionTitle title="Waiver Records" count={waivers.length} />
      <AdminTable testid="admin-waivers-table" head={["Signed Name", "Contact", "Submitted", "Waiver Version", "Verification", "Player Record", ""]}>
        {waivers.length === 0 ? (
          <EmptyRow colSpan={7}>No waiver records yet.</EmptyRow>
        ) : waivers.map((w) => {
          const profile = w.profile_id ? getProfile(state, w.profile_id) : null;
          return (
            <TableRow key={w.id} data-testid={`admin-waiver-${w.id}`} className="border-border">
              <TableCell className="font-medium text-foreground whitespace-nowrap">{w.signed_name}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{w.email}{w.phone ? ` · ${w.phone}` : ""}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtTs(w.signed_at)}</TableCell>
              <TableCell className="text-micro text-muted-foreground whitespace-nowrap">{w.waiver_version}</TableCell>
              <TableCell><StatusBadge status={w.verification_status} /></TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {profile ? (
                  <Link to={`/profile/${profile.id}`} className="text-foreground hover:text-primary">{profile.name}</Link>
                ) : (
                  <span className="text-muted-foreground/60">Unlinked</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end whitespace-nowrap">
                  <IconBtn onClick={() => { updateEntity("waivers", w.id, { verification_status: "verified" }); toast.success("Waiver verified — eligibility still requires team/season assignment"); }} icon={CheckCircle} title="Mark verified" testid={`admin-waiver-verify-${w.id}`} disabled={w.verification_status === "verified"} />
                  <IconBtn onClick={() => { updateEntity("waivers", w.id, { verification_status: "pending" }); toast("Waiver flagged for review"); }} icon={Flag} title="Needs review" testid={`admin-waiver-review-${w.id}`} disabled={w.verification_status === "pending"} />
                  <IconBtn icon={LinkSimple} title="Link to player record — ships with the backend" testid={`admin-waiver-link-${w.id}`} disabled />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </AdminTable>
    </div>
  );
}

/* ---------- shared table & button primitives ---------- */
const IconBtn = ({ onClick, icon: Icon, testid, danger, title, disabled }) => (
  <button onClick={onClick} disabled={disabled} title={title} data-testid={testid} className={`p-2 rounded-lg transition-colors ${disabled ? "text-muted-foreground/30 cursor-not-allowed" : danger ? "text-destructive hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-white/10"}`}>
    <Icon size={16} weight="bold" />
  </button>
);
const AddBtn = ({ onClick, label, testid }) => (
  <button onClick={onClick} data-testid={testid} className="flex items-center gap-1.5 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-xs px-3.5 py-2 rounded-lg hover:bg-teal-deep transition-colors">
    <Plus size={15} weight="bold" /> {label}
  </button>
);
const fmtTs = (ts) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Confirmation gate for destructive actions. Controlled via a `confirm` object
// { title, message, confirmLabel, onConfirm }; null when closed.
const ConfirmDialog = ({ confirm, onClose }) => (
  <AlertDialog open={!!confirm} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto" data-testid="admin-confirm">
      {confirm && (
        <>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-tight text-foreground">{confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="admin-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="admin-confirm-accept"
              onClick={() => { confirm.onConfirm(); onClose(); }}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {confirm.confirmLabel || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </>
      )}
    </AlertDialogContent>
  </AlertDialog>
);

// Timestamped admin notes on a triage record, newest first.
const NotesList = ({ notes }) =>
  notes?.length ? (
    <div className="mt-2.5 pt-2.5 border-t border-border space-y-1">
      {[...notes].reverse().map((n, i) => (
        <p key={i} className="text-xs text-muted-foreground">
          <span className="text-muted-foreground/60">{fmtTs(n.timestamp)}</span> — {n.text}
        </p>
      ))}
    </div>
  ) : null;

const NoteModal = ({ noteFor, setNoteFor, onSave }) => (
  <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title="Add Admin Note" onSave={onSave}>
    {noteFor && (
      <ModalField label="Note">
        <Textarea data-testid="admin-note-text" value={noteFor.text} onChange={(e) => setNoteFor({ ...noteFor, text: e.target.value })} className="bg-surface-sunken border-border" />
      </ModalField>
    )}
  </Modal>
);

const SectionTitle = ({ title, count, action }) => (
  <div className="flex justify-between items-center gap-3">
    <p className="font-display uppercase tracking-tight text-foreground">
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
            <TableHead key={i} className="text-micro uppercase tracking-widest text-muted-foreground whitespace-nowrap h-9">{h}</TableHead>
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
  const [confirm, setConfirm] = useState(null);

  const save = () => {
    if (!modal.name?.trim() || !modal.sport) return toast.error("Name and sport required");
    if (modal.id) updateEntity("leagues", modal.id, { name: modal.name, sport: modal.sport, description: modal.description });
    else createEntity("leagues", { name: modal.name, sport: modal.sport, season: state.settings.current_season, description: modal.description || "" }, "l");
    toast.success(modal.id ? "League updated" : "League created");
    setModal(null);
  };

  const teamsIn = (league_id) => state.teams.filter((t) => t.league_id === league_id);
  const playersIn = (league_id) => {
    const teamIds = teamsIn(league_id).map((t) => t.id);
    return new Set(state.teamPlayers.filter((tp) => teamIds.includes(tp.team_id)).map((tp) => tp.profile_id)).size;
  };

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="font-display uppercase tracking-tight text-foreground mb-3">Registration Windows</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {SPORTS.map((s) => {
            const open = state.settings.registration_open[s.id];
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 bg-surface-sunken border border-border rounded-lg p-3">
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
                <span className="font-medium text-foreground">{l.name}</span>
              </div>
            </TableCell>
            <TableCell><SportBadge sport={l.sport} /></TableCell>
            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{l.season}</TableCell>
            <TableCell className="text-xs text-foreground text-center">{teamsIn(l.id).length}</TableCell>
            <TableCell className="text-xs text-foreground text-center">{playersIn(l.id)}</TableCell>
            <TableCell><StatusBadge status={l.status || "active"} /></TableCell>
            <TableCell>
              <div className="flex items-center justify-end">
                <IconBtn onClick={() => setModal({ id: l.id, name: l.name, sport: l.sport, description: l.description })} icon={PencilSimple} title="Edit league" testid={`admin-edit-league-${l.id}`} />
                <IconBtn onClick={() => setConfirm({ title: "Delete league?", message: `Delete “${l.name}”? Its ${teamsIn(l.id).length} team(s) and games stay in the data but lose their league link. This cannot be undone.`, onConfirm: () => { deleteEntity("leagues", l.id); toast.success("League deleted"); } })} icon={Trash} title="Delete league" testid={`admin-delete-league-${l.id}`} danger />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </AdminTable>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Edit League" : "New League"} onSave={save}>
        {modal && (
          <>
            <ModalField label="Name"><Input data-testid="admin-league-name" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} className="bg-surface-sunken border-border" /></ModalField>
            <ModalField label="Sport">
              <Select value={modal.sport} onValueChange={(v) => setModal({ ...modal, sport: v })}>
                <SelectTrigger className="bg-surface-sunken border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{SPORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </ModalField>
            <ModalField label="Description"><Textarea value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} className="bg-surface-sunken border-border" /></ModalField>
          </>
        )}
      </Modal>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

/* ------------------------------ TEAMS ------------------------------------ */
function TeamsTab({ app }) {
  const { state, createEntity, updateEntity, deleteEntity } = app;
  const [modal, setModal] = useState(null);
  const [rosterFor, setRosterFor] = useState(null); // team_id whose roster is open
  const [confirm, setConfirm] = useState(null);
  const rosterTeam = rosterFor && getTeam(state, rosterFor);

  const save = () => {
    if (!modal.name?.trim() || !modal.sport || !modal.league_id) return toast.error("Name, sport & league required");
    const data = { name: modal.name, sport: modal.sport, league_id: modal.league_id, captain_id: modal.captain_id || null, logo_color: modal.logo_color || "#5BB8CC", founded: modal.founded || "2026" };
    if (modal.id) updateEntity("teams", modal.id, data);
    else createEntity("teams", data, "t");
    toast.success(modal.id ? "Team updated" : "Team created");
    setModal(null);
  };

  const leaguesForSport = state.leagues.filter((l) => !modal?.sport || l.sport === modal.sport);
  const rosterCount = (team_id) => state.teamPlayers.filter((tp) => tp.team_id === team_id).length;

  return (
    <div className="space-y-3">
      <SectionTitle title="Teams" count={state.teams.length} action={<AddBtn onClick={() => setModal({ name: "", sport: "kickball", league_id: "", captain_id: "", logo_color: "#5BB8CC", founded: "2026" })} label="New Team" testid="admin-add-team" />} />
      <AdminTable testid="admin-teams-table" head={["Team", "Sport", "League / Season", "Captain", "Roster", "Waivers", "Status", ""]}>
        {state.teams.length === 0 ? (
          <EmptyRow colSpan={8}>No teams yet. Approve a registration or create one directly.</EmptyRow>
        ) : state.teams.map((t) => {
          const league = getLeague(state, t.league_id);
          const captain = getProfile(state, t.captain_id);
          const rec = computeTeamRecord(state, t.id);
          return (
            <TableRow key={t.id} data-testid={`admin-team-${t.id}`} className="border-border">
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.logo_color }} />
                  <Link to={`/team/${t.id}`} className="font-medium text-foreground hover:text-primary">{t.name}</Link>
                  <span className="text-micro text-muted-foreground">{rec.wins}-{rec.losses}</span>
                </div>
              </TableCell>
              <TableCell><SportBadge sport={t.sport} /></TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{league ? `${league.name} · ${league.season}` : "—"}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {captain ? (<><span className="text-foreground">{captain.name}</span><span className="text-muted-foreground"> · {captain.phone}</span></>) : <span className="text-muted-foreground/60">—</span>}
              </TableCell>
              <TableCell className="text-xs text-foreground text-center">{rosterCount(t.id)}</TableCell>
              {/* Waiver/eligibility summary is a placeholder until waiver records exist (later stage). */}
              <TableCell className="text-xs text-muted-foreground/60">—</TableCell>
              <TableCell><StatusBadge status={t.status || "active"} /></TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <IconBtn onClick={() => setRosterFor(t.id)} icon={UsersThree} title="Manage roster" testid={`admin-roster-team-${t.id}`} />
                  <IconBtn onClick={() => setModal({ id: t.id, name: t.name, sport: t.sport, league_id: t.league_id, captain_id: t.captain_id, logo_color: t.logo_color, founded: t.founded })} icon={PencilSimple} title="Edit team" testid={`admin-edit-team-${t.id}`} />
                  <IconBtn onClick={() => setConfirm({ title: "Delete team?", message: `Delete “${t.name}”? The team record is removed; its ${rosterCount(t.id)} roster assignment(s) and any games stay in the data but lose their team link. This cannot be undone.`, onConfirm: () => { deleteEntity("teams", t.id); toast.success("Team deleted"); } })} icon={Trash} title="Delete team" testid={`admin-delete-team-${t.id}`} danger />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </AdminTable>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Edit Team" : "New Team"} onSave={save}>
        {modal && (
          <>
            <ModalField label="Team Name"><Input data-testid="admin-team-name" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} className="bg-surface-sunken border-border" /></ModalField>
            <ModalField label="Sport">
              <Select value={modal.sport} onValueChange={(v) => setModal({ ...modal, sport: v, league_id: "" })}>
                <SelectTrigger className="bg-surface-sunken border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{SPORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </ModalField>
            <ModalField label="League">
              <Select value={modal.league_id} onValueChange={(v) => setModal({ ...modal, league_id: v })}>
                <SelectTrigger className="bg-surface-sunken border-border"><SelectValue placeholder="Select league" /></SelectTrigger>
                <SelectContent>{leaguesForSport.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </ModalField>
            <ModalField label="Captain">
              <Select value={modal.captain_id || ""} onValueChange={(v) => setModal({ ...modal, captain_id: v })}>
                <SelectTrigger className="bg-surface-sunken border-border"><SelectValue placeholder="Select captain" /></SelectTrigger>
                <SelectContent>{state.profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </ModalField>
          </>
        )}
      </Modal>

      {/* Roster management — same team_players relationship as the player modal.
          Changes apply immediately; "Done" just closes. */}
      <Dialog open={!!rosterFor} onOpenChange={(o) => !o && setRosterFor(null)}>
        {/* Long rosters scroll internally so the Done action stays pinned. */}
        <DialogContent className="bg-card border-border max-h-[90vh] flex flex-col" data-testid="admin-roster-modal" aria-describedby={undefined}>
          <DialogHeader className="shrink-0"><DialogTitle className="font-display uppercase tracking-tight text-foreground">{rosterTeam ? `${rosterTeam.name} · Roster` : "Roster"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 flex-1 overflow-y-auto min-h-0">
            {rosterFor && <AssignmentEditor app={app} mode="team" team_id={rosterFor} />}
          </div>
          <DialogFooter className="shrink-0">
            <button onClick={() => setRosterFor(null)} data-testid="admin-roster-done" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold uppercase text-sm">Done</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

/* ----------------------------- PLAYERS ----------------------------------- */
// Reusable roster-assignment editor. The SAME team_players relationship is
// read/written from two entry points — the player modal (mode="player", pick a
// team) and the team roster view (mode="team", pick a player) — so there is one
// source of truth, not two parallel systems. Assignment NEVER touches
// eligibility. Season is auto-stamped from the team's active league season.
// PHASE 2: these become real team_players rows; intake-conversion is built then.
function AssignmentEditor({ app, mode, profile_id, team_id }) {
  const { state, assignPlayerToTeam, removePlayerFromTeam } = app;
  const [sel, setSel] = useState("");
  const [jersey_number, setJersey] = useState("");

  const rows = state.teamPlayers.filter((tp) => (mode === "player" ? tp.profile_id === profile_id : tp.team_id === team_id));
  const assignedIds = new Set(rows.map((tp) => (mode === "player" ? tp.team_id : tp.profile_id)));
  const options = mode === "player"
    ? state.teams.filter((t) => !assignedIds.has(t.id))
    : state.profiles.filter((p) => !assignedIds.has(p.id));

  const seasonFor = (tId) => {
    const team = getTeam(state, tId);
    const league = team ? getLeague(state, team.league_id) : null;
    return league?.season || state.settings.current_season;
  };
  const pendingSeason = mode === "player" ? (sel ? seasonFor(sel) : null) : seasonFor(team_id);

  const add = () => {
    if (!sel) return toast.error(mode === "player" ? "Select a team" : "Select a player");
    assignPlayerToTeam(mode === "player" ? { profile_id, team_id: sel, jersey_number } : { profile_id: sel, team_id, jersey_number });
    toast.success("Assignment added");
    setSel(""); setJersey("");
  };

  return (
    <div className="space-y-2" data-testid={`assignment-editor-${mode}`}>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No team assignments yet.</p>
      ) : rows.map((tp) => {
        const team = getTeam(state, tp.team_id);
        const prof = getProfile(state, tp.profile_id);
        return (
          <div key={tp.id} data-testid={`assignment-${tp.id}`} className="flex items-center gap-2 bg-surface-sunken border border-border rounded-lg px-2.5 py-2">
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              {mode === "team" && prof && <EligibilityIndicator status={prof.eligibility_status} />}
              <span className="text-sm text-foreground truncate">{mode === "player" ? (team?.name || "Unknown team") : (prof?.name || "Unknown player")}</span>
              {mode === "player" && team && <SportBadge sport={team.sport} />}
            </div>
            <span className="text-micro text-muted-foreground tabular-nums whitespace-nowrap">{tp.jersey_number != null ? `#${tp.jersey_number}` : "—"} · {tp.season}</span>
            <IconBtn onClick={() => { removePlayerFromTeam(tp.id); toast.success("Assignment removed"); }} icon={X} title="Remove assignment" testid={`assignment-remove-${tp.id}`} danger />
          </div>
        );
      })}
      {options.length > 0 && (
        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1 min-w-0">
            <Select value={sel} onValueChange={setSel}>
              <SelectTrigger data-testid="assignment-select" className="bg-surface-sunken border-border h-9"><SelectValue placeholder={mode === "player" ? "Add to team…" : "Add player…"} /></SelectTrigger>
              <SelectContent>
                {options.map((o) => <SelectItem key={o.id} value={o.id}>{mode === "player" ? `${o.name} (${sportName(o.sport)})` : o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input type="number" min="0" value={jersey_number} onChange={(e) => setJersey(e.target.value)} placeholder="#" data-testid="assignment-jersey_number" className="w-16 bg-surface-sunken border-border h-9 text-center" />
          <button onClick={add} data-testid="assignment-add" className="h-9 px-3 rounded-lg bg-primary text-primary-foreground font-bold uppercase text-xs whitespace-nowrap">Add</button>
        </div>
      )}
      {pendingSeason && (
        <p className="text-micro text-muted-foreground">Season auto-stamped: <span className="text-foreground">{pendingSeason}</span></p>
      )}
    </div>
  );
}

const blankPlayer = () => ({ first_name: "", last_name: "", display_name: "", email: "", phone: "", dob: "", age_confirmed: false, emergency_contact_name: "", emergency_contact_phone: "", admin_notes: "", eligibility_status: "not_verified" });

function PlayersTab({ app }) {
  const { state, updateEntity, createPlayer, resendInvite } = app;
  const [modal, setModal] = useState(null);
  const counts = claimStats(state);

  const teamsFor = (profile_id) => {
    const ids = state.teamPlayers.filter((tp) => tp.profile_id === profile_id).map((tp) => tp.team_id);
    return state.teams.filter((t) => ids.includes(t.id));
  };

  const openEdit = (p) => setModal({
    id: p.id, first_name: p.first_name || "", last_name: p.last_name || "", display_name: p.display_name || "",
    email: p.email || "", phone: p.phone || "", dob: p.dob || "", age_confirmed: !!p.age_confirmed,
    emergency_contact_name: p.emergency_contact_name || "", emergency_contact_phone: p.emergency_contact_phone || "",
    admin_notes: typeof p.admin_notes === "string" ? p.admin_notes : "", eligibility_status: p.eligibility_status || "not_verified",
  });

  const save = () => {
    if (!modal.first_name.trim() || !modal.last_name.trim()) return toast.error("First and last name are required");
    const display = modal.display_name.trim();
    const data = {
      first_name: modal.first_name.trim(), last_name: modal.last_name.trim(), display_name: display || null,
      name: display || `${modal.first_name.trim()} ${modal.last_name.trim()}`.trim(),
      email: modal.email.trim(), phone: modal.phone.trim(), dob: modal.dob || null, age_confirmed: !!modal.age_confirmed,
      emergency_contact_name: modal.emergency_contact_name.trim() || null, emergency_contact_phone: modal.emergency_contact_phone.trim() || null,
      admin_notes: modal.admin_notes, eligibility_status: modal.eligibility_status,
    };
    if (modal.id) { updateEntity("profiles", modal.id, data); toast.success("Player record updated"); }
    else { createPlayer(data); toast.success("Player created"); }
    setModal(null);
  };

  const set = (k, v) => setModal((m) => ({ ...m, [k]: v }));

  return (
    <div className="space-y-3">
      {/* FINAL DRAFT: claimed/unclaimed counts are account metrics — Season 1
          has no player accounts, so these stay hidden until final-draft review. */}
      {FINAL_DRAFT && (
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Total", value: counts.total, c: "text-foreground" }, { label: "Claimed", value: counts.claimed, c: "text-teal" }, { label: "Unclaimed", value: counts.unclaimed, c: "text-gold" }].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={`font-mono-score text-2xl font-bold ${s.c}`}>{s.value}</p>
              <p className="text-micro uppercase tracking-widest text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <SectionTitle title="Player Records" count={state.profiles.length} action={<AddBtn onClick={() => setModal(blankPlayer())} label="Add Player" testid="admin-add-player" />} />
      <AdminTable testid="admin-players-table" head={["Player", "Email", "Phone", "Sports", "Team(s)", "Season", "Eligibility", "Notes", ""]}>
        {state.profiles.length === 0 ? (
          <EmptyRow colSpan={9}>No player records yet. Use “Add Player” to create one.</EmptyRow>
        ) : state.profiles.map((p) => {
          const pTeams = teamsFor(p.id);
          return (
            <TableRow key={p.id} data-testid={`admin-player-${p.id}`} className="border-border">
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Avatar name={p.name} color={p.avatar_color} size={26} />
                  <Link to={`/profile/${p.id}`} className="font-medium text-foreground hover:text-primary">{p.name}</Link>
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{p.email || "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{p.phone || "—"}</TableCell>
              <TableCell><div className="flex gap-1">{(p.sports || []).map((s) => <SportBadge key={s} sport={s} />)}</div></TableCell>
              <TableCell className="text-xs text-foreground whitespace-nowrap">{pTeams.length ? pTeams.map((t) => t.name).join(", ") : <span className="text-muted-foreground/60">Unassigned</span>}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{state.settings.current_season}</TableCell>
              {/* Eligibility is purely INFORMATIONAL (CLAUDE.md) — it gates nothing.
                  PHASE 2: this flag becomes real waiver verification status. */}
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                  <EligibilityIndicator status={p.eligibility_status} />
                  {p.eligibility_status === "verified" ? "Verified" : "Not verified"}
                </span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{p.admin_notes || "—"}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end whitespace-nowrap">
                  <IconBtn onClick={() => openEdit(p)} icon={PencilSimple} title="Edit player record" testid={`admin-edit-player-${p.id}`} />
                  {/* FINAL DRAFT: resend-invite / mark-claimed are account features — no player accounts in Season 1. */}
                  {FINAL_DRAFT && !p.claimed && (
                    <button onClick={() => { resendInvite(p.id); toast.success(`Invite resent to ${p.name}`); }} data-testid={`admin-resend-${p.id}`} className="flex items-center gap-1 text-xs font-semibold text-primary border border-primary/40 rounded-lg px-2.5 py-1.5">
                      <PaperPlaneTilt size={13} weight="bold" /> Resend
                    </button>
                  )}
                  {FINAL_DRAFT && (
                    <button onClick={() => updateEntity("profiles", p.id, { claimed: !p.claimed })} data-testid={`admin-toggle-claim-${p.id}`} className="text-xs text-muted-foreground hover:text-foreground px-2">
                      {p.claimed ? "Unclaim" : "Mark claimed"}
                    </button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </AdminTable>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Edit Player Record" : "Add Player"} onSave={save}>
        {modal && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="First Name"><Input data-testid="admin-player-first" value={modal.first_name} onChange={(e) => set("first_name", e.target.value)} className="bg-surface-sunken border-border" /></ModalField>
              <ModalField label="Last Name"><Input data-testid="admin-player-last" value={modal.last_name} onChange={(e) => set("last_name", e.target.value)} className="bg-surface-sunken border-border" /></ModalField>
            </div>
            <ModalField label="Display Name (optional)"><Input data-testid="admin-player-display" value={modal.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="Nickname / preferred name" className="bg-surface-sunken border-border" /></ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Email"><Input data-testid="admin-player-email" value={modal.email} onChange={(e) => set("email", e.target.value)} className="bg-surface-sunken border-border" /></ModalField>
              <ModalField label="Phone"><Input data-testid="admin-player-phone" value={modal.phone} onChange={(e) => set("phone", e.target.value)} className="bg-surface-sunken border-border" /></ModalField>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <ModalField label="Date of Birth (optional)"><Input type="date" data-testid="admin-player-dob" value={modal.dob || ""} onChange={(e) => set("dob", e.target.value)} className="bg-surface-sunken border-border" /></ModalField>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <Checkbox data-testid="admin-player-age" checked={modal.age_confirmed} onCheckedChange={(v) => set("age_confirmed", !!v)} />
                <span className="text-sm text-foreground">Confirmed 18+</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Emergency Contact"><Input data-testid="admin-player-ec-name" value={modal.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} placeholder="Name" className="bg-surface-sunken border-border" /></ModalField>
              <ModalField label="Emergency Phone"><Input data-testid="admin-player-ec-phone" value={modal.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} placeholder="Phone" className="bg-surface-sunken border-border" /></ModalField>
            </div>
            <ModalField label="Eligibility (informational — never blocks play)">
              <Select value={modal.eligibility_status} onValueChange={(v) => set("eligibility_status", v)}>
                <SelectTrigger data-testid="admin-player-eligibility" className="bg-surface-sunken border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_verified">Not verified</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                </SelectContent>
              </Select>
            </ModalField>
            <ModalField label="Admin Notes"><Textarea data-testid="admin-player-notes" value={modal.admin_notes} onChange={(e) => set("admin_notes", e.target.value)} className="bg-surface-sunken border-border" /></ModalField>

            {/* Team assignments are a RELATIONSHIP, not a profile field. They are
                independent of eligibility and apply immediately (no Save needed). */}
            <div className="pt-1 border-t border-border">
              <Label className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 mt-3 block">Team Assignments</Label>
              {modal.id
                ? <AssignmentEditor app={app} mode="player" profile_id={modal.id} />
                : <p className="text-xs text-muted-foreground">Save this player first, then reopen to assign teams.</p>}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------- REGISTRATIONS -------------------------------- */
// Team Interest triage. Status vocabulary per CLAUDE.md:
// new / contacted / approved / archived.
// FINAL DRAFT: approving should eventually auto-create the team record —
// for Season 1, approval is a status change only (review at final draft).
function RegistrationsTab({ app }) {
  const { state, updateRegistrationStatus, appendAdminNote } = app;
  const regs = state.registrations;
  const newCount = regs.filter((r) => r.status === "new").length;
  const [noteFor, setNoteFor] = useState(null); // {id, text}

  const setStatus = (r, status, msg) => { updateRegistrationStatus(r.id, status); toast.success(msg); };
  const saveNote = () => {
    if (!noteFor.text?.trim()) return toast.error("Note text required");
    appendAdminNote("registrations", noteFor.id, noteFor.text.trim());
    toast.success("Note added");
    setNoteFor(null);
  };

  return (
    <div className="space-y-3">
      <SectionTitle title="Team Registrations" count={`${newCount} new of ${regs.length}`} />
      {regs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
          No team registrations yet. Team Interest submissions land here for triage.
        </div>
      ) : regs.map((r) => (
        <div key={r.id} data-testid={`admin-registration-${r.id}`} className="bg-card border border-border rounded-xl p-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{r.team_name}</p>
              <p className="text-xs text-muted-foreground truncate">{r.captain_name} · {r.captain_email || r.captain_phone} · submitted {r.created_at}</p>
            </div>
            <SportBadge sport={r.sport} />
            <StatusBadge status={r.status} />
            <div className="flex items-center">
              <IconBtn onClick={() => setStatus(r, "contacted", "Marked contacted")} icon={Phone} title="Mark contacted" testid={`admin-reg-contact-${r.id}`} disabled={r.status === "contacted"} />
              <IconBtn onClick={() => setStatus(r, "approved", `${r.team_name} approved`)} icon={CheckCircle} title="Approve" testid={`admin-reg-approve-${r.id}`} disabled={r.status === "approved"} />
              <IconBtn onClick={() => setStatus(r, "archived", "Registration archived")} icon={Archive} title="Archive" testid={`admin-reg-archive-${r.id}`} disabled={r.status === "archived"} />
              <IconBtn onClick={() => setNoteFor({ id: r.id, text: "" })} icon={NotePencil} title="Add note" testid={`admin-reg-note-${r.id}`} />
            </div>
          </div>
          <NotesList notes={r.admin_notes} />
        </div>
      ))}
      <NoteModal noteFor={noteFor} setNoteFor={setNoteFor} onSave={saveNote} />
    </div>
  );
}

/* -------------------------- SCHEDULE / GAMES ------------------------------ */
function GamesTab({ app }) {
  const { state, assignTempAdmin, updateEntity, lockGame, setGameStatus } = app;
  const [modal, setModal] = useState(null); // {id, date, time, location}
  const [rescheduleFor, setRescheduleFor] = useState(null); // game_id

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
          const a = getTeam(state, g.away_team_id), h = getTeam(state, g.home_team_id);
          const league = getLeague(state, g.league_id);
          return (
            <TableRow key={g.id} data-testid={`admin-game-${g.id}`} className="border-border">
              <TableCell className="text-xs text-foreground whitespace-nowrap">{fmtDate(g.date)} · {g.time}</TableCell>
              <TableCell><SportBadge sport={g.sport} /></TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{league ? `${league.name} · ${league.season}` : "—"}</TableCell>
              <TableCell className="whitespace-nowrap"><Link to={`/game/${g.id}`} className="text-foreground font-medium hover:text-primary">{a.name} @ {h.name}</Link></TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{g.location}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={g.status} />
                  {g.locked && <LockSimple size={14} weight="bold" className="text-gold" title="Locked" />}
                </div>
              </TableCell>
              <TableCell><StatusBadge status={g.score_status || "pending"} /></TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                  <IconBtn onClick={() => setModal({ id: g.id, date: g.date, time: g.time, location: g.location })} icon={PencilSimple} title={g.locked ? "Locked — unlock in Scores/Stats to edit" : "Edit game"} testid={`admin-edit-game-${g.id}`} disabled={g.locked} />
                  {g.locked ? (
                    <span title="Locked — unlock in Scores/Stats to edit" data-testid={`admin-game-enter-score-${g.id}`} className="p-2 inline-flex text-muted-foreground/30 cursor-not-allowed">
                      <LockSimple size={16} weight="bold" />
                    </span>
                  ) : (
                    <Link to="/score-entry" state={{ game_id: g.id }} title="Enter score" data-testid={`admin-game-enter-score-${g.id}`} className="p-2 rounded-lg text-primary hover:bg-white/10 transition-colors inline-flex">
                      <PencilSimpleLine size={16} weight="bold" />
                    </Link>
                  )}
                  <IconBtn onClick={() => { lockGame(g.id); toast.success("Game marked final & locked"); }} icon={CheckCircle} title={canMarkFinal(g) ? "Mark final & lock" : "Mark final — needs a submitted or approved score"} testid={`admin-mark-final-game-${g.id}`} disabled={!canMarkFinal(g)} />
                  <IconBtn onClick={() => setRescheduleFor(g.id)} icon={CalendarX} title={g.locked ? "Locked — unlock in Scores/Stats first" : "Postpone / cancel"} testid={`admin-postpone-${g.id}`} disabled={g.locked} />
                  {/* FINAL DRAFT: temp-admin score-keepers are non-admin logins —
                      out of scope for admin-only Season 1, hidden until review. */}
                  {FINAL_DRAFT && (
                    <Select value={g.temp_admin_id || "none"} onValueChange={(v) => { assignTempAdmin(g.id, v === "none" ? null : v); toast.success(v === "none" ? "Temp admin cleared" : "Temp admin assigned"); }}>
                      <SelectTrigger data-testid={`admin-tempadmin-${g.id}`} className="bg-surface-sunken border-border h-9 w-36 text-xs"><SelectValue placeholder="Temp admin" /></SelectTrigger>
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
      <p className="text-micro text-muted-foreground">Actions: edit game · enter score · mark final & lock · postpone/cancel. Locked games must be unlocked in Scores/Stats before editing.</p>

      <Dialog open={!!rescheduleFor} onOpenChange={(o) => !o && setRescheduleFor(null)}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto" data-testid="admin-reschedule-modal">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-tight text-foreground">Postpone or Cancel Game</DialogTitle></DialogHeader>
          <DialogDescription className="text-sm text-muted-foreground py-1">Updates the public schedule and logs to the game's edit history.</DialogDescription>
          <DialogFooter>
            <button onClick={() => setRescheduleFor(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">Back</button>
            <button onClick={() => { setGameStatus(rescheduleFor, "postponed"); toast.success("Game postponed"); setRescheduleFor(null); }} data-testid="admin-confirm-postpone" className="px-4 py-2 rounded-lg border border-[#F5B82E]/40 text-gold font-bold uppercase text-sm">Postpone</button>
            <button onClick={() => { setGameStatus(rescheduleFor, "canceled"); toast.success("Game canceled"); setRescheduleFor(null); }} data-testid="admin-confirm-cancel" className="px-4 py-2 rounded-lg border border-destructive/40 text-destructive font-bold uppercase text-sm">Cancel Game</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Modal open={!!modal} onClose={() => setModal(null)} title="Edit Game" onSave={save}>
        {modal && (
          <>
            <ModalField label="Date"><Input type="date" data-testid="admin-game-date" value={modal.date} onChange={(e) => setModal({ ...modal, date: e.target.value })} className="bg-surface-sunken border-border" /></ModalField>
            <ModalField label="Time"><Input data-testid="admin-game-time" value={modal.time} onChange={(e) => setModal({ ...modal, time: e.target.value })} className="bg-surface-sunken border-border" /></ModalField>
            <ModalField label="Location"><Input data-testid="admin-game-location" value={modal.location} onChange={(e) => setModal({ ...modal, location: e.target.value })} className="bg-surface-sunken border-border" /></ModalField>
          </>
        )}
      </Modal>
    </div>
  );
}

/* --------------------------- SCORES / STATS ------------------------------- */
// Operational score flow: pending → submitted (score saved) → final (Mark
// Final, which LOCKS the game). Unlock is deliberate: confirm + required
// reason, recorded in the game's edit history (mock audit log).
const canMarkFinal = (g) => !g.locked && (g.score_status === "submitted" || g.score_status === "approved");

function ScoresTab({ app }) {
  const { state, lockGame, unlockGame } = app;
  const [unlockFor, setUnlockFor] = useState(null); // {id, reason}
  const [openHistory, setOpenHistory] = useState({});

  const needs = state.games
    .filter((g) => g.score_status === "pending" || g.score_status === "submitted")
    .sort((x, y) => x.date.localeCompare(y.date));

  const doUnlock = () => {
    if (!unlockFor.reason?.trim()) return toast.error("A reason is required to unlock");
    unlockGame(unlockFor.id, unlockFor.reason.trim());
    toast.success("Game unlocked — further edits will be recorded");
    setUnlockFor(null);
  };

  const renderRow = (g, prefix) => {
    const a = getTeam(state, g.away_team_id), h = getTeam(state, g.home_team_id);
    const done = g.status === "completed";
    const hist = g.edit_history || [];
    return (
      <div key={g.id} data-testid={`${prefix}-${g.id}`} className="bg-card border border-border rounded-xl p-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate flex items-center gap-1.5">
              {g.locked && <LockSimple size={14} weight="bold" className="text-gold shrink-0" />}
              {a.name} @ {h.name}
            </p>
            <p className="text-xs text-muted-foreground">{fmtDate(g.date)} · {done ? `${g.away_score}-${g.home_score}` : "Not played"}</p>
          </div>
          <SportBadge sport={g.sport} />
          <StatusBadge status={g.score_status || "pending"} />
          {g.locked ? (
            <button disabled title="Locked — unlock to edit" data-testid={`${prefix}-enter-${g.id}`} className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground/40 border border-border rounded-lg px-3 py-2 cursor-not-allowed">
              <LockSimple size={14} weight="bold" /> Locked
            </button>
          ) : (
            <Link to="/score-entry" state={{ game_id: g.id }} data-testid={`${prefix}-enter-${g.id}`} className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary border border-primary/40 rounded-lg px-3 py-2">
              <PencilSimpleLine size={14} weight="bold" /> {done ? "Edit" : "Enter"}
            </Link>
          )}
          {g.locked ? (
            <IconBtn onClick={() => setUnlockFor({ id: g.id, reason: "" })} icon={LockSimpleOpen} title="Unlock game" testid={`admin-unlock-${g.id}`} />
          ) : (
            <IconBtn onClick={() => { lockGame(g.id); toast.success("Game marked final & locked"); }} icon={CheckCircle} title={canMarkFinal(g) ? "Mark final & lock" : "Mark final — needs a submitted or approved score"} testid={`admin-mark-final-${g.id}`} disabled={!canMarkFinal(g)} />
          )}
          {hist.length > 0 && (
            <button onClick={() => setOpenHistory((o) => ({ ...o, [g.id]: !o[g.id] }))} data-testid={`admin-history-${g.id}`} title="Edit history" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-1">
              <ClockCounterClockwise size={14} weight="bold" /> {hist.length}
            </button>
          )}
        </div>
        {openHistory[g.id] && hist.length > 0 && (
          <div data-testid={`admin-history-list-${g.id}`} className="mt-2.5 pt-2.5 border-t border-border space-y-1">
            {[...hist].reverse().map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="text-muted-foreground/60">{fmtTs(e.timestamp)}</span> — <span className="text-foreground">{e.action}</span>{e.reason ? <span> · “{e.reason}”</span> : null}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="bg-card border border-[#F5B82E]/30 rounded-xl p-4">
        <p className="font-display uppercase tracking-tight text-foreground mb-1">Games Needing Scores ({needs.length})</p>
        <p className="text-xs text-muted-foreground mb-3">Pending — no score yet · Submitted — awaiting Mark Final.</p>
        {needs.length === 0 ? (
          <p className="text-xs text-muted-foreground">All caught up — every game is approved or final.</p>
        ) : (
          <div className="space-y-2">{needs.map((g) => renderRow(g, "admin-needs"))}</div>
        )}
      </div>
      <SectionTitle title="All Games" count={state.games.length} />
      {state.games.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
          No games scheduled yet. Games appear here once a schedule is created.
        </div>
      ) : (
        state.games.map((g) => renderRow(g, "admin-score"))
      )}

      <Modal open={!!unlockFor} onClose={() => setUnlockFor(null)} title="Unlock Game" onSave={doUnlock}>
        {unlockFor && (
          <>
            <p className="text-sm text-muted-foreground">Unlocking allows score edits. This will be recorded in the game's edit history.</p>
            <ModalField label="Reason (required)">
              <Textarea data-testid="admin-unlock-reason" value={unlockFor.reason} onChange={(e) => setUnlockFor({ ...unlockFor, reason: e.target.value })} className="bg-surface-sunken border-border" />
            </ModalField>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ---------------------------- FREE AGENTS -------------------------------- */
// Intake triage. Status vocabulary per CLAUDE.md: new / contacted / assigned / archived.
function AgentsTab({ app }) {
  const { state, setFreeAgentStatus, updateEntity, appendAdminNote } = app;
  const [noteFor, setNoteFor] = useState(null); // {id, text}
  const [assignFor, setAssignFor] = useState(null); // {id, team_id}

  const setStatus = (a, status, msg) => { setFreeAgentStatus(a.id, status); toast.success(msg); };
  const saveNote = () => {
    if (!noteFor.text?.trim()) return toast.error("Note text required");
    appendAdminNote("freeAgents", noteFor.id, noteFor.text.trim());
    toast.success("Note added");
    setNoteFor(null);
  };

  const assignAgent = assignFor && state.freeAgents.find((a) => a.id === assignFor.id);
  const eligibleTeams = assignAgent ? state.teams.filter((t) => assignAgent.sports.includes(t.sport)) : [];
  const saveAssign = () => {
    if (!assignFor.team_id) return toast.error("Select a team");
    // PHASE 2: real assignment creates a team_players record AFTER waiver
    // verification. For now we only record the intended team on the agent —
    // it does NOT add them to the team roster.
    updateEntity("freeAgents", assignFor.id, { assigned_team_id: assignFor.team_id, status: "assigned" });
    toast.success("Free agent assigned");
    setAssignFor(null);
  };

  return (
    <div className="space-y-3">
      {state.freeAgents.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
          No free agent submissions yet. Free Agent intake lands here for triage.
        </div>
      )}
      {state.freeAgents.map((a) => (
        <div key={a.id} data-testid={`admin-agent-${a.id}`} className="bg-card border border-border rounded-xl p-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Avatar name={freeAgentName(a)} color="#5BB8CC" size={36} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{freeAgentName(a)}</p>
              <p className="text-xs text-muted-foreground truncate">
                {a.experience} · {a.sports.map(sportName).join(", ")}
                {a.assigned_team_id && <span className="text-primary"> → {getTeam(state, a.assigned_team_id)?.name || "Unknown team"}</span>}
              </p>
            </div>
            <StatusBadge status={a.status} />
            <div className="flex items-center">
              <IconBtn onClick={() => setStatus(a, "contacted", "Marked contacted")} icon={Phone} title="Mark contacted" testid={`admin-agent-contact-${a.id}`} disabled={a.status === "contacted"} />
              <IconBtn onClick={() => setAssignFor({ id: a.id, team_id: a.assigned_team_id || "" })} icon={UserPlus} title="Assign to team" testid={`admin-agent-assign-${a.id}`} />
              <IconBtn onClick={() => setStatus(a, "archived", "Free agent archived")} icon={Archive} title="Archive" testid={`admin-agent-archive-${a.id}`} disabled={a.status === "archived"} />
              <IconBtn onClick={() => setNoteFor({ id: a.id, text: "" })} icon={NotePencil} title="Add note" testid={`admin-agent-note-${a.id}`} />
            </div>
          </div>
          <NotesList notes={a.admin_notes} />
        </div>
      ))}

      <NoteModal noteFor={noteFor} setNoteFor={setNoteFor} onSave={saveNote} />
      <Modal open={!!assignFor} onClose={() => setAssignFor(null)} title="Assign to Team" onSave={saveAssign}>
        {assignFor && (
          <>
            <p className="text-sm text-muted-foreground">
              Records the intended team on this free agent. Roster placement happens through waiver verification — this does not add them to the roster.
            </p>
            <ModalField label={`Team (${assignAgent?.sports.map(sportName).join(" / ")})`}>
              <Select value={assignFor.team_id} onValueChange={(v) => setAssignFor({ ...assignFor, team_id: v })}>
                <SelectTrigger data-testid="admin-assign-team" className="bg-surface-sunken border-border"><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {eligibleTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({sportName(t.sport)})</SelectItem>)}
                </SelectContent>
              </Select>
            </ModalField>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ modal ------------------------------------ */
// aria-describedby={undefined} per Radix docs: descriptions are passed as
// visible children here, so suppress the missing-Description warning once.
const Modal = ({ open, onClose, title, onSave, children }) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    {/* Capped at the viewport: body scrolls internally so Save/Cancel stay pinned and reachable. */}
    <DialogContent className="bg-card border-border max-h-[90vh] flex flex-col" data-testid="admin-modal" aria-describedby={undefined}>
      <DialogHeader className="shrink-0"><DialogTitle className="font-display uppercase tracking-tight text-foreground">{title}</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2 flex-1 overflow-y-auto min-h-0">{children}</div>
      <DialogFooter className="shrink-0">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        <button onClick={onSave} data-testid="admin-modal-save" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold uppercase text-sm">Save</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
const ModalField = ({ label, children }) => (
  <div>
    <Label className="text-micro uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 block">{label}</Label>
    {children}
  </div>
);
