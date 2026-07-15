import { useMemo, useState } from "react";
import { Medal, PencilSimple, Plus, Trash, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getProfile, getTeam } from "../../lib/selectors";
import { sportName } from "../../lib/statsConfig";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

const blankEntry = (season) => ({ id: null, entry_type: "player", game_id: "", profile_id: "", team_id: "", sport: "kickball", season, record_scope: "season", title: "", blurb: "", stat_key: "", stat_value: "", display_order: "0" });
const EMPTY_LIST = [];

function contextLabel(state, entry) {
  if (entry.entry_type === "game") {
    const game = state.games.find((item) => item.id === entry.game_id);
    const home = getTeam(state, game?.home_team_id)?.name;
    const away = getTeam(state, game?.away_team_id)?.name;
    return game ? `${game.date} · ${home} vs ${away}` : "Missing game";
  }
  if (entry.entry_type === "player") return getProfile(state, entry.profile_id)?.name || "Missing player";
  const profile = getProfile(state, entry.profile_id)?.name;
  const team = getTeam(state, entry.team_id)?.name;
  return [entry.record_scope, profile, team].filter(Boolean).join(" · ") || entry.record_scope;
}

export default function HallOfFameTab({ app }) {
  const { state, createEntity, updateEntity, deleteEntity, setHofPublished } = app;
  const entries = state.hofEntries || EMPTY_LIST;
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [type, setType] = useState("all");
  const [sport, setSport] = useState("all");
  const visible = useMemo(() => entries
    .filter((entry) => type === "all" || entry.entry_type === type)
    .filter((entry) => sport === "all" || entry.sport === sport)
    .sort((a, b) => Number(a.display_order) - Number(b.display_order) || String(a.created_at || "").localeCompare(String(b.created_at || ""))), [entries, type, sport]);

  const openEntry = (entry = null) => setForm(entry ? {
    ...blankEntry(entry.season || state.settings.current_seasons?.kickball),
    ...entry,
    game_id: entry.game_id || "",
    profile_id: entry.profile_id || "",
    team_id: entry.team_id || "",
    sport: entry.sport || "none",
    season: entry.season || "none",
    record_scope: entry.record_scope || "season",
    blurb: entry.blurb || "",
    stat_key: entry.stat_key || "",
    stat_value: entry.stat_value || "",
    display_order: String(entry.display_order ?? 0),
  } : blankEntry(state.settings.current_seasons?.kickball || state.settings.current_season || state.seasons[0]?.name || ""));

  const save = async () => {
    if (!form.title.trim()) return toast.error("A curated title is required.");
    if (form.entry_type === "game" && !form.game_id) return toast.error("Select the inducted game.");
    if (form.entry_type === "player" && !form.profile_id) return toast.error("Select the inducted player.");
    const row = {
      entry_type: form.entry_type,
      game_id: form.entry_type === "game" || (form.entry_type === "record" && form.game_id) ? form.game_id || null : null,
      profile_id: form.entry_type === "player" || (form.entry_type === "record" && form.profile_id) ? form.profile_id || null : null,
      team_id: form.entry_type === "record" ? form.team_id || null : null,
      sport: form.sport === "none" ? null : form.sport,
      season: form.season === "none" ? null : form.season,
      record_scope: form.entry_type === "record" ? form.record_scope : null,
      title: form.title.trim(),
      blurb: form.blurb.trim() || null,
      stat_key: form.stat_key.trim() || null,
      stat_value: form.stat_value.trim() || null,
      display_order: Number.parseInt(form.display_order, 10) || 0,
    };
    try {
      if (form.id) await updateEntity("hofEntries", form.id, row);
      else await createEntity("hofEntries", row, "hof");
      toast.success(form.id ? "Hall of Fame entry updated" : "Hall of Fame entry curated");
      setForm(null);
    } catch { /* backend action surfaces details */ }
  };

  const remove = (entry) => setConfirm({
    title: "Delete curated entry?",
    description: `“${entry.title}” will be removed. This does not alter the underlying game, player, team, or statistics.`,
    action: async () => { await deleteEntity("hofEntries", entry.id); toast.success("Hall of Fame entry deleted"); },
  });

  return (
    <div className="space-y-4" data-testid="admin-hof">
      <div className="rounded-xl border border-gold/35 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-display uppercase tracking-tight text-foreground">Curated Hall of Fame Draft</p><p className="mt-1 max-w-3xl text-xs text-muted-foreground">Entries are editorial snapshots, never auto-generated. Titles, blurbs, and stat values will not drift when source stats are corrected. The curation screen is admin-only.</p></div>
          <span className={`rounded-full border px-2.5 py-1 text-micro font-bold uppercase ${state.settings.hof_published ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border bg-surface-sunken text-muted-foreground"}`}>{state.settings.hof_published ? "Public API: Published" : "Unpublished"}</span>
        </div>
        {state.settings.hof_published ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3"><p className="flex items-center gap-2 text-xs text-destructive"><Warning size={16} weight="fill" />Entries are currently public through the allowlisted database view, even though no public Hall of Fame page ships in this stage.</p><Button variant="outline" onClick={() => setConfirm({ title: "Unpublish Hall of Fame?", description: "Anonymous and non-admin Data API reads will immediately return no Hall of Fame rows.", action: async () => { await setHofPublished(false); toast.success("Hall of Fame unpublished"); } })}>Unpublish Now</Button></div> : <p className="mt-3 text-xs text-muted-foreground">Publishing stays unavailable until the public Hall of Fame experience is deliberately approved. The database gate remains off.</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-end">
        <Filter label="Entry Type" value={type} onChange={setType}><SelectItem value="all">All types</SelectItem><SelectItem value="game">Games</SelectItem><SelectItem value="player">Players</SelectItem><SelectItem value="record">Records</SelectItem></Filter>
        <Filter label="Sport" value={sport} onChange={setSport}><SelectItem value="all">All sports</SelectItem><SelectItem value="kickball">Kickball</SelectItem><SelectItem value="flag_football">Flag Football</SelectItem></Filter>
        <div className="flex-1" />
        <Button onClick={() => openEntry()} data-testid="hof-add-entry"><Plus size={16} /> Curate Entry</Button>
      </div>

      {!visible.length ? <div className="rounded-xl border border-border bg-card py-12 text-center"><Medal size={36} className="mx-auto text-muted-foreground" /><p className="mt-3 font-display uppercase text-foreground">No curated entries</p><p className="mt-1 text-xs text-muted-foreground">Create a game, player, or record inscription when the story is worth preserving.</p></div> : <div className="grid gap-3 md:grid-cols-2">{visible.map((entry) => <article key={entry.id} className="rounded-xl border border-border bg-card p-4" data-testid={`hof-entry-${entry.id}`}><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold"><Medal size={19} weight="fill" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-micro font-bold uppercase tracking-widest text-gold">{entry.entry_type}</span><span className="text-micro text-muted-foreground">Order {entry.display_order}</span></div><h3 className="mt-1 font-display text-lg uppercase tracking-tight text-foreground">{entry.title}</h3><p className="mt-1 text-xs text-primary">{contextLabel(state, entry)}</p>{entry.blurb && <p className="mt-2 text-sm text-muted-foreground">{entry.blurb}</p>}{(entry.stat_key || entry.stat_value) && <div className="mt-3 inline-flex items-baseline gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2"><span className="text-micro uppercase text-muted-foreground">{entry.stat_key || "Curated stat"}</span><span className="font-mono-score text-xl font-bold text-gold">{entry.stat_value || "—"}</span></div>}<p className="mt-3 text-micro uppercase text-muted-foreground">{entry.sport ? sportName(entry.sport) : "All sports"}{entry.season ? ` · ${entry.season}` : ""}</p></div><div className="flex"><IconButton label="Edit entry" icon={PencilSimple} onClick={() => openEntry(entry)} /><IconButton label="Delete entry" icon={Trash} danger onClick={() => remove(entry)} /></div></div></article>)}</div>}

      <EntryDialog state={state} form={form} setForm={setForm} onSave={save} />
      <ConfirmDialog confirm={confirm} setConfirm={setConfirm} />
    </div>
  );
}

function EntryDialog({ state, form, setForm, onSave }) {
  if (!form) return null;
  const gameLabel = (game) => `${game.date} · ${getTeam(state, game.home_team_id)?.name || "Home"} vs ${getTeam(state, game.away_team_id)?.name || "Away"}`;
  const setType = (entry_type) => setForm({ ...form, entry_type, game_id: "", profile_id: "", team_id: "", record_scope: "season" });
  return <Dialog open onOpenChange={(open) => !open && setForm(null)}><DialogContent className="max-h-[90vh] overflow-y-auto bg-card border-border"><DialogHeader><DialogTitle className="font-display uppercase">{form.id ? "Edit Inscription" : "Curate Entry"}</DialogTitle><DialogDescription>Capture the editorial wording and stat snapshot exactly as it should appear later.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Filter label="Type" value={form.entry_type} onChange={setType}><SelectItem value="game">Game</SelectItem><SelectItem value="player">Player</SelectItem><SelectItem value="record">Record</SelectItem></Filter><Filter label="Sport" value={form.sport} onChange={(sport) => setForm({ ...form, sport })}><SelectItem value="none">Not specified</SelectItem><SelectItem value="kickball">Kickball</SelectItem><SelectItem value="flag_football">Flag Football</SelectItem></Filter><Filter label="Season" value={form.season} onChange={(season) => setForm({ ...form, season })}><SelectItem value="none">Not specified</SelectItem>{state.seasons.map((season) => <SelectItem key={season.name} value={season.name}>{season.name}</SelectItem>)}</Filter>{form.entry_type === "record" && <Filter label="Record Scope" value={form.record_scope} onChange={(record_scope) => setForm({ ...form, record_scope })}><SelectItem value="game">Single game</SelectItem><SelectItem value="season">Season</SelectItem><SelectItem value="career">Career</SelectItem></Filter>}{form.entry_type === "game" && <div className="sm:col-span-2"><Filter label="Inducted Game" value={form.game_id || "none"} onChange={(game_id) => setForm({ ...form, game_id: game_id === "none" ? "" : game_id })}><SelectItem value="none" disabled>Select a game</SelectItem>{state.games.map((game) => <SelectItem key={game.id} value={game.id}>{gameLabel(game)}</SelectItem>)}</Filter></div>}{form.entry_type === "player" && <div className="sm:col-span-2"><Filter label="Inducted Player" testid="hof-profile" value={form.profile_id || "none"} onChange={(profile_id) => setForm({ ...form, profile_id: profile_id === "none" ? "" : profile_id })}><SelectItem value="none" disabled>Select a player</SelectItem>{state.profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}</Filter></div>}{form.entry_type === "record" && <><Filter label="Player Context (optional)" value={form.profile_id || "none"} onChange={(profile_id) => setForm({ ...form, profile_id: profile_id === "none" ? "" : profile_id })}><SelectItem value="none">No player</SelectItem>{state.profiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}</Filter><Filter label="Team Context (optional)" value={form.team_id || "none"} onChange={(team_id) => setForm({ ...form, team_id: team_id === "none" ? "" : team_id })}><SelectItem value="none">No team</SelectItem>{state.teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</Filter><div className="sm:col-span-2"><Filter label="Game Context (optional)" value={form.game_id || "none"} onChange={(game_id) => setForm({ ...form, game_id: game_id === "none" ? "" : game_id })}><SelectItem value="none">No game</SelectItem>{state.games.map((game) => <SelectItem key={game.id} value={game.id}>{gameLabel(game)}</SelectItem>)}</Filter></div></>}<div className="sm:col-span-2"><Field label="Title"><Input data-testid="hof-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="bg-surface-sunken border-border" /></Field></div><div className="sm:col-span-2"><Field label="Blurb"><Textarea value={form.blurb} onChange={(event) => setForm({ ...form, blurb: event.target.value })} className="bg-surface-sunken border-border" /></Field></div><Field label="Stat Label (optional)"><Input value={form.stat_key} onChange={(event) => setForm({ ...form, stat_key: event.target.value })} placeholder="Career home runs" className="bg-surface-sunken border-border" /></Field><Field label="Curated Value (optional)"><Input value={form.stat_value} onChange={(event) => setForm({ ...form, stat_value: event.target.value })} placeholder="42" className="bg-surface-sunken border-border" /></Field><Field label="Display Order"><Input type="number" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: event.target.value })} className="bg-surface-sunken border-border" /></Field></div><DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button data-testid="hof-save-entry" onClick={onSave}>Save Inscription</Button></DialogFooter></DialogContent></Dialog>;
}

const IconButton = ({ label, icon: Icon, onClick, danger }) => <button type="button" aria-label={label} title={label} onClick={onClick} className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg p-2 ${danger ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}><Icon size={16} weight="bold" /></button>;
const Filter = ({ label, testid, value, onChange, children }) => <div className="min-w-40"><Label className="mb-1 block text-micro uppercase tracking-widest text-muted-foreground">{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger data-testid={testid} className="bg-surface-sunken border-border"><SelectValue /></SelectTrigger><SelectContent>{children}</SelectContent></Select></div>;
const Field = ({ label, children }) => <div><Label className="mb-1 block text-micro uppercase tracking-widest text-muted-foreground">{label}</Label>{children}</div>;
const ConfirmDialog = ({ confirm, setConfirm }) => <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}><AlertDialogContent className="bg-card border-border"><AlertDialogHeader><AlertDialogTitle className="font-display uppercase">{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-foreground hover:bg-destructive/90" onClick={async () => { try { await confirm.action(); } catch { /* backend action surfaces details */ } finally { setConfirm(null); } }}>{confirm?.title?.startsWith("Unpublish") ? "Unpublish" : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
