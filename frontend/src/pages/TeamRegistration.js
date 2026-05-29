import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash, CheckCircle, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { SectionHeading } from "../components/common/Section";
import { SPORTS } from "../lib/statsConfig";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

const MIN = 5, MAX = 15;
const emptyPlayer = () => ({ name: "", email: "" });

export default function TeamRegistration() {
  const { state, addRegistration } = useApp();
  const [teamName, setTeamName] = useState("");
  const [sport, setSport] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [roster, setRoster] = useState(Array.from({ length: MIN }, emptyPlayer));
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const setPlayer = (i, field, val) =>
    setRoster((r) => r.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));
  const addPlayer = () => roster.length < MAX && setRoster((r) => [...r, emptyPlayer()]);
  const removePlayer = (i) => roster.length > MIN && setRoster((r) => r.filter((_, idx) => idx !== i));

  const validate = () => {
    const e = {};
    if (!teamName.trim()) e.teamName = "Team name is required";
    if (!sport) e.sport = "Select a sport";
    if (!captainName.trim()) e.captainName = "Captain name is required";
    if (!/^\S+@\S+\.\S+$/.test(captainEmail)) e.captainEmail = "Valid email required";
    const named = roster.filter((p) => p.name.trim());
    if (named.length < MIN) e.roster = `At least ${MIN} players with names required (${named.length}/${MIN})`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    addRegistration({
      teamName: teamName.trim(),
      sport,
      captainName: captainName.trim(),
      captainEmail: captainEmail.trim(),
      captainPhone: captainPhone.trim(),
      roster: roster.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), email: p.email.trim() })),
    });
    // PHASE 2: POST to /registrations + send captain confirmation email.
    setSubmitted(true);
    toast.success("Team submitted! An admin will review it shortly.");
  };

  const regOpen = sport ? state.settings.registrationOpen[sport] : true;

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-10 text-center animate-fade-up" data-testid="registration-success">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={34} weight="fill" className="text-primary" />
        </div>
        <h1 className="font-display uppercase tracking-tight text-2xl text-white">Registration Submitted</h1>
        <p className="text-muted-foreground mt-2 text-sm"><span className="text-white font-semibold">{teamName}</span> is now pending admin review. You'll be notified once it's approved.</p>
        <div className="flex gap-3 justify-center mt-6">
          <Link to="/" className="border border-white/15 text-white font-bold uppercase tracking-wide text-sm px-5 py-3 rounded-xl hover:border-primary transition-colors">Home</Link>
          <button onClick={() => { setSubmitted(false); setTeamName(""); setSport(""); setCaptainName(""); setCaptainEmail(""); setCaptainPhone(""); setRoster(Array.from({ length: MIN }, emptyPlayer)); }} className="bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm px-5 py-3 rounded-xl">Register Another</button>
        </div>
      </div>
    );
  }

  const namedCount = roster.filter((p) => p.name.trim()).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
      <SectionHeading title="Team Registration" subtitle="Lock in your squad for the season" />

      {sport && !regOpen && (
        <div className="flex items-center gap-2 bg-[#facc15]/10 border border-[#facc15]/30 rounded-xl p-3 text-sm text-[#facc15]">
          <Warning size={18} weight="bold" /> Registration for this sport is currently closed. You can still submit; an admin will queue it.
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <Field label="Team Name" error={errors.teamName}>
          <Input data-testid="reg-team-name" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Sandia Sluggers" className="bg-[#0f0f0f] border-border" />
        </Field>
        <Field label="Sport" error={errors.sport}>
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger data-testid="reg-sport" className="bg-[#0f0f0f] border-border h-10"><SelectValue placeholder="Choose a sport" /></SelectTrigger>
            <SelectContent>{SPORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Captain Name" error={errors.captainName}>
            <Input data-testid="reg-captain-name" value={captainName} onChange={(e) => setCaptainName(e.target.value)} className="bg-[#0f0f0f] border-border" />
          </Field>
          <Field label="Captain Email" error={errors.captainEmail}>
            <Input data-testid="reg-captain-email" type="email" value={captainEmail} onChange={(e) => setCaptainEmail(e.target.value)} className="bg-[#0f0f0f] border-border" />
          </Field>
        </div>
        <Field label="Captain Phone (optional)">
          <Input data-testid="reg-captain-phone" value={captainPhone} onChange={(e) => setCaptainPhone(e.target.value)} className="bg-[#0f0f0f] border-border" />
        </Field>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-display uppercase tracking-tight text-white">Roster</p>
            <p className={`text-xs ${namedCount >= MIN ? "text-[#10b981]" : "text-muted-foreground"}`}>{namedCount} of {MIN}–{MAX} players</p>
          </div>
          <button onClick={addPlayer} disabled={roster.length >= MAX} data-testid="reg-add-player" className="flex items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-40">
            <Plus size={16} weight="bold" /> Add
          </button>
        </div>
        {errors.roster && <p className="text-xs text-destructive mb-2">{errors.roster}</p>}
        <div className="space-y-2">
          {roster.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
              <Input data-testid={`reg-player-name-${i}`} value={p.name} onChange={(e) => setPlayer(i, "name", e.target.value)} placeholder="Player name" className="bg-[#0f0f0f] border-border flex-1" />
              <Input data-testid={`reg-player-email-${i}`} value={p.email} onChange={(e) => setPlayer(i, "email", e.target.value)} placeholder="email (optional)" className="bg-[#0f0f0f] border-border flex-1 hidden sm:block" />
              <button onClick={() => removePlayer(i)} disabled={roster.length <= MIN} className="text-muted-foreground hover:text-destructive disabled:opacity-30 p-1"><Trash size={16} weight="bold" /></button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={submit} data-testid="reg-submit" className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm py-4 rounded-xl hover:bg-[#06b6d4] transition-colors">
        Submit Registration
      </button>
    </div>
  );
}

const Field = ({ label, error, children }) => (
  <div>
    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 block">{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);
