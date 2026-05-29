import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { SectionHeading } from "../components/common/Section";
import { SPORTS } from "../lib/statsConfig";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export default function FreeAgentSignup() {
  const { addFreeAgent } = useApp();
  const [form, setForm] = useState({ name: "", email: "", phone: "", experience: "", notes: "" });
  const [sports, setSports] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSport = (id) => setSports((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Valid email required";
    if (!sports.length) e.sports = "Pick at least one sport";
    if (!form.experience) e.experience = "Select your experience level";
    setErrors(e);
    if (Object.keys(e).length) { toast.error("Please fix the highlighted fields"); return; }
    addFreeAgent({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), sports, experience: form.experience, notes: form.notes.trim() });
    // PHASE 2: POST to /free_agents + notify captains looking for that sport.
    setSubmitted(true);
    toast.success("You're in the free agent pool! Captains can now find you.");
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-10 text-center animate-fade-up" data-testid="free-agent-success">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={34} weight="fill" className="text-primary" />
        </div>
        <h1 className="font-display uppercase tracking-tight text-2xl text-white">You're in the Pool!</h1>
        <p className="text-muted-foreground mt-2 text-sm">Captains looking for players can now send you an invite. Keep an eye on your inbox.</p>
        <div className="flex gap-3 justify-center mt-6">
          <Link to="/" className="bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm px-5 py-3 rounded-xl">Back Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-up">
      <SectionHeading title="Free Agent Sign-Up" subtitle="No team? Get found by captains." />
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <Field label="Full Name" error={errors.name}>
          <Input data-testid="fa-name" value={form.name} onChange={(e) => set("name", e.target.value)} className="bg-[#0f0f0f] border-border" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email" error={errors.email}>
            <Input data-testid="fa-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="bg-[#0f0f0f] border-border" />
          </Field>
          <Field label="Phone (optional)">
            <Input data-testid="fa-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="bg-[#0f0f0f] border-border" />
          </Field>
        </div>
        <Field label="Preferred Sports" error={errors.sports}>
          <div className="flex flex-wrap gap-2 mt-1">
            {SPORTS.map((s) => (
              <label key={s.id} data-testid={`fa-sport-${s.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${sports.includes(s.id) ? "border-primary bg-primary/10" : "border-border"}`}>
                <Checkbox checked={sports.includes(s.id)} onCheckedChange={() => toggleSport(s.id)} />
                <span className="text-sm text-white">{s.name}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Experience Level" error={errors.experience}>
          <Select value={form.experience} onValueChange={(v) => set("experience", v)}>
            <SelectTrigger data-testid="fa-experience" className="bg-[#0f0f0f] border-border h-10"><SelectValue placeholder="Select level" /></SelectTrigger>
            <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Notes (optional)">
          <Textarea data-testid="fa-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Positions, availability, anything captains should know…" className="bg-[#0f0f0f] border-border" />
        </Field>
      </div>
      <button onClick={submit} data-testid="fa-submit" className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm py-4 rounded-xl hover:bg-[#06b6d4] transition-colors">
        Join Free Agent Pool
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
