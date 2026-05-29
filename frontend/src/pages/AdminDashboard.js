import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Trophy, UsersThree, UserCircle, CalendarBlank, PencilSimpleLine, PaperPlaneTilt,
  Plus, Trash, PencilSimple, CheckCircle, XCircle, Power,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { getTeam, getProfile, getLeague, computeTeamRecord, claimStats } from "../lib/selectors";
import { SPORTS, sportName } from "../lib/statsConfig";
import { SectionHeading } from "../components/common/Section";
import { SportBadge, StatusBadge } from "../components/common/Badges";
import { Avatar } from "../components/common/Avatar";
import { RoleGate } from "../components/layout/RoleGate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

export default function AdminDashboard() {
  return (
    <RoleGate allow={["admin"]} title="Admin Dashboard">
      <Dashboard />
    </RoleGate>
  );
}

function Dashboard() {
  const app = useApp();
  const { state } = app;
  const tabs = [
    { id: "leagues", label: "Leagues", icon: Trophy },
    { id: "teams", label: "Teams", icon: UsersThree },
    { id: "players", label: "Players", icon: UserCircle },
    { id: "games", label: "Games", icon: CalendarBlank },
    { id: "scores", label: "Scores", icon: PencilSimpleLine },
    { id: "agents", label: "Free Agents", icon: PaperPlaneTilt },
  ];

  return (
    <div className="space-y-5 animate-fade-up">
      <SectionHeading title="Admin Dashboard" subtitle="Manage everything across CVF Sports" />
      <Tabs defaultValue="leagues">
        <TabsList className="bg-card border border-border w-full flex overflow-x-auto h-auto p-1 justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} data-testid={`admin-tab-${t.id}`} className="data-[state=active]:bg-primary data-[state=active]:text-black uppercase text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 px-3 py-2">
              <t.icon size={15} weight="bold" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="leagues" className="mt-4"><LeaguesTab app={app} /></TabsContent>
        <TabsContent value="teams" className="mt-4"><TeamsTab app={app} /></TabsContent>
        <TabsContent value="players" className="mt-4"><PlayersTab app={app} /></TabsContent>
        <TabsContent value="games" className="mt-4"><GamesTab app={app} /></TabsContent>
        <TabsContent value="scores" className="mt-4"><ScoresTab app={app} /></TabsContent>
        <TabsContent value="agents" className="mt-4"><AgentsTab app={app} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- shared row + modal primitives ---------- */
const Row = ({ children, testid }) => (
  <div data-testid={testid} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3.5">{children}</div>
);
const IconBtn = ({ onClick, icon: Icon, testid, danger }) => (
  <button onClick={onClick} data-testid={testid} className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${danger ? "text-destructive" : "text-muted-foreground hover:text-white"}`}>
    <Icon size={16} weight="bold" />
  </button>
);
const AddBtn = ({ onClick, label, testid }) => (
  <button onClick={onClick} data-testid={testid} className="flex items-center gap-1.5 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-xs px-3.5 py-2 rounded-lg hover:bg-[#06b6d4] transition-colors">
    <Plus size={15} weight="bold" /> {label}
  </button>
);

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

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="font-display uppercase tracking-tight text-white mb-3">Registration Windows</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {SPORTS.map((s) => {
            const open = state.settings.registrationOpen[s.id];
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 bg-[#0f0f0f] border border-border rounded-lg p-3">
                <div className="flex items-center gap-2"><SportBadge sport={s.id} /><StatusBadge status={open ? "available" : "rejected"} /></div>
                <button onClick={() => { toggleRegistration(s.id); toast.success(`${s.name} registration ${open ? "closed" : "opened"}`); }} data-testid={`admin-toggle-reg-${s.id}`} className={`flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1.5 rounded-lg ${open ? "text-destructive border border-destructive/40" : "text-primary border border-primary/40"}`}>
                  <Power size={14} weight="bold" /> {open ? "Close" : "Open"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="font-display uppercase tracking-tight text-white">Leagues</p>
        <AddBtn onClick={() => setModal({ name: "", sport: "kickball", description: "" })} label="New League" testid="admin-add-league" />
      </div>
      {state.leagues.map((l) => (
        <Row key={l.id} testid={`admin-league-${l.id}`}>
          <Trophy size={20} weight="duotone" className="text-primary" />
          <div className="flex-1 min-w-0">
            <p className="font-display uppercase tracking-tight text-white truncate">{l.name}</p>
            <p className="text-xs text-muted-foreground">{l.season}</p>
          </div>
          <SportBadge sport={l.sport} />
          <IconBtn onClick={() => setModal({ id: l.id, name: l.name, sport: l.sport, description: l.description })} icon={PencilSimple} testid={`admin-edit-league-${l.id}`} />
          <IconBtn onClick={() => { deleteEntity("leagues", l.id); toast.success("League deleted"); }} icon={Trash} testid={`admin-delete-league-${l.id}`} danger />
        </Row>
      ))}

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
  const { state, createEntity, updateEntity, deleteEntity, updateRegistrationStatus } = app;
  const [modal, setModal] = useState(null);
  const pending = state.registrations.filter((r) => r.status === "pending");

  const save = () => {
    if (!modal.name?.trim() || !modal.sport || !modal.leagueId) return toast.error("Name, sport & league required");
    const data = { name: modal.name, sport: modal.sport, leagueId: modal.leagueId, captainId: modal.captainId || null, logoColor: modal.logoColor || "#22d3ee", founded: modal.founded || "2026" };
    if (modal.id) updateEntity("teams", modal.id, data);
    else createEntity("teams", data, "t");
    toast.success(modal.id ? "Team updated" : "Team created");
    setModal(null);
  };

  const leaguesForSport = state.leagues.filter((l) => !modal?.sport || l.sport === modal.sport);

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="bg-card border border-[#facc15]/30 rounded-xl p-4">
          <p className="font-display uppercase tracking-tight text-white mb-3">Pending Registrations ({pending.length})</p>
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} data-testid={`admin-registration-${r.id}`} className="flex items-center gap-3 bg-[#0f0f0f] border border-border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{r.teamName}</p>
                  <p className="text-xs text-muted-foreground">{r.captainName} · {r.roster.length} players</p>
                </div>
                <SportBadge sport={r.sport} />
                <IconBtn onClick={() => { updateRegistrationStatus(r.id, "approved"); toast.success(`${r.teamName} approved`); }} icon={CheckCircle} testid={`admin-approve-reg-${r.id}`} />
                <IconBtn onClick={() => { updateRegistrationStatus(r.id, "rejected"); toast("Registration rejected"); }} icon={XCircle} testid={`admin-reject-reg-${r.id}`} danger />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Phase 2: approving will auto-create the team & invite the roster.</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="font-display uppercase tracking-tight text-white">Teams</p>
        <AddBtn onClick={() => setModal({ name: "", sport: "kickball", leagueId: "", captainId: "", logoColor: "#22d3ee", founded: "2026" })} label="New Team" testid="admin-add-team" />
      </div>
      {state.teams.map((t) => {
        const rec = computeTeamRecord(state, t.id);
        return (
          <Row key={t.id} testid={`admin-team-${t.id}`}>
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.logoColor }} />
            <div className="flex-1 min-w-0">
              <Link to={`/team/${t.id}`} className="font-display uppercase tracking-tight text-white truncate hover:text-primary block">{t.name}</Link>
              <p className="text-xs text-muted-foreground">{getLeague(state, t.leagueId)?.name} · {rec.wins}-{rec.losses}</p>
            </div>
            <SportBadge sport={t.sport} />
            <IconBtn onClick={() => setModal({ id: t.id, name: t.name, sport: t.sport, leagueId: t.leagueId, captainId: t.captainId, logoColor: t.logoColor, founded: t.founded })} icon={PencilSimple} testid={`admin-edit-team-${t.id}`} />
            <IconBtn onClick={() => { deleteEntity("teams", t.id); toast.success("Team deleted"); }} icon={Trash} testid={`admin-delete-team-${t.id}`} danger />
          </Row>
        );
      })}

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
  const counts = claimStats(state);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[{ label: "Total", value: counts.total, c: "text-white" }, { label: "Claimed", value: counts.claimed, c: "text-[#10b981]" }, { label: "Unclaimed", value: counts.unclaimed, c: "text-[#facc15]" }].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`font-mono-score text-2xl font-bold ${s.c}`}>{s.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {state.profiles.map((p) => (
          <Row key={p.id} testid={`admin-player-${p.id}`}>
            <Avatar name={p.name} color={p.avatarColor} size={36} />
            <div className="flex-1 min-w-0">
              <Link to={`/profile/${p.id}`} className="font-medium text-white truncate hover:text-primary block">{p.name}</Link>
              <p className="text-xs text-muted-foreground truncate">{p.email}</p>
            </div>
            <StatusBadge status={p.claimed ? "approved" : "invited"} />
            {!p.claimed && (
              <button onClick={() => { resendInvite(p.id); toast.success(`Invite resent to ${p.name}`); }} data-testid={`admin-resend-${p.id}`} className="flex items-center gap-1 text-xs font-semibold text-primary border border-primary/40 rounded-lg px-2.5 py-1.5">
                <PaperPlaneTilt size={13} weight="bold" /> Resend
              </button>
            )}
            <button onClick={() => updateEntity("profiles", p.id, { claimed: !p.claimed })} data-testid={`admin-toggle-claim-${p.id}`} className="text-xs text-muted-foreground hover:text-white px-2">
              {p.claimed ? "Unclaim" : "Mark claimed"}
            </button>
          </Row>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ GAMES ------------------------------------ */
function GamesTab({ app }) {
  const { state, assignTempAdmin } = app;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-1">Assign a temp admin (score-keeper) to any game.</p>
      {state.games.map((g) => {
        const a = getTeam(state, g.awayTeamId), h = getTeam(state, g.homeTeamId);
        return (
          <Row key={g.id} testid={`admin-game-${g.id}`}>
            <div className="flex-1 min-w-0">
              <Link to={`/game/${g.id}`} className="font-medium text-white truncate hover:text-primary block">{a.name} @ {h.name}</Link>
              <p className="text-xs text-muted-foreground">{new Date(g.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {g.time}</p>
            </div>
            <StatusBadge status={g.status} />
            <Select value={g.tempAdminId || "none"} onValueChange={(v) => { assignTempAdmin(g.id, v === "none" ? null : v); toast.success(v === "none" ? "Temp admin cleared" : "Temp admin assigned"); }}>
              <SelectTrigger data-testid={`admin-tempadmin-${g.id}`} className="bg-[#0f0f0f] border-border h-9 w-36 text-xs"><SelectValue placeholder="Temp admin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No temp admin</SelectItem>
                {state.profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
        );
      })}
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
function AgentsTab({ app }) {
  const { state, setFreeAgentStatus } = app;
  return (
    <div className="space-y-2">
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
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
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
