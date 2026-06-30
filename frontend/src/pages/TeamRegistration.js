import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { SectionHeading } from "../components/common/Section";
import { SPORTS } from "../lib/statsConfig";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

export default function TeamRegistration() {
  const { state, addRegistration } = useApp();
  const [form, setForm] = useState({
    captainName: "",
    captainPhone: "",
    captainEmail: "",
    sport: "",
    teamName: "",
    estimatedRosterSize: "",
    notes: "",
  });
  const [consentToContact, setConsentToContact] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.captainName.trim()) e.captainName = "Captain name is required";
    if (!form.captainPhone.trim() && !form.captainEmail.trim()) e.contact = "Phone or email is required";
    if (form.captainEmail.trim() && !/^\S+@\S+\.\S+$/.test(form.captainEmail)) e.captainEmail = "Enter a valid email address";
    if (!form.sport) e.sport = "Select a sport";
    if (!form.teamName.trim()) e.teamName = "Team name is required";
    if (!consentToContact) e.consent = "You must agree to be contacted";
    return e;
  };

  const reset = () => {
    setForm({ captainName: "", captainPhone: "", captainEmail: "", sport: "", teamName: "", estimatedRosterSize: "", notes: "" });
    setConsentToContact(false);
    setSubmitted(false);
  };

  const submit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { toast.error("Please fix the highlighted fields"); return; }
    addRegistration({
      captainName: form.captainName.trim(),
      captainPhone: form.captainPhone.trim(),
      captainEmail: form.captainEmail.trim(),
      sport: form.sport,
      teamName: form.teamName.trim(),
      estimatedRosterSize: form.estimatedRosterSize ? Number(form.estimatedRosterSize) : null,
      preferredSeason: state.settings.currentSeason,
      consentToContact: true,
      notes: form.notes.trim() || null,
    });
    // PHASE 2: POST to /registrations + send captain confirmation email.
    setSubmitted(true);
    toast.success("Team submitted! An admin will review it shortly.");
  };

  const regOpen = form.sport ? state.settings.registrationOpen[form.sport] : true;

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-10 text-center animate-fade-up" data-testid="registration-success">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={34} weight="fill" className="text-primary" />
        </div>
        <h1 className="font-display uppercase tracking-tight text-display-lg text-foreground">Registration Submitted</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          <span className="text-foreground font-semibold">{form.teamName}</span> is now pending admin review. You'll be notified once it's approved.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Link to="/" className="border border-white/15 text-foreground font-bold uppercase tracking-wide text-sm px-5 py-3 rounded-xl hover:border-primary transition-colors">
            Home
          </Link>
          <button onClick={reset} className="bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm px-5 py-3 rounded-xl">
            Register Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-up">
      <SectionHeading title="Team Interest" subtitle="Tell us about your team — an admin will reach out." />

      {form.sport && !regOpen && (
        <div className="flex items-center gap-2 bg-[#F5B82E]/10 border border-[#F5B82E]/30 rounded-xl p-3 text-sm text-gold">
          <Warning size={18} weight="bold" /> Registration for this sport is currently closed. You can still submit; an admin will queue it.
        </div>
      )}

      {/* Captain info */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-display uppercase tracking-tight text-foreground text-sm">Captain Info</p>
        <Field label="Legal Name" required error={errors.captainName}>
          <Input data-testid="reg-captain-name" value={form.captainName} onChange={(e) => set("captainName", e.target.value)} placeholder="First and last name" className="bg-surface-sunken border-border" />
        </Field>
        <Field label="Contact" required error={errors.contact || errors.captainEmail} hint="At least one of phone or email is required">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input data-testid="reg-captain-phone" value={form.captainPhone} onChange={(e) => set("captainPhone", e.target.value)} placeholder="Phone" className="bg-surface-sunken border-border" />
            <Input data-testid="reg-captain-email" type="email" value={form.captainEmail} onChange={(e) => set("captainEmail", e.target.value)} placeholder="Email" className="bg-surface-sunken border-border" />
          </div>
        </Field>
      </div>

      {/* Team info */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-display uppercase tracking-tight text-foreground text-sm">Team Info</p>
        <Field label="Team Name" required error={errors.teamName}>
          <Input data-testid="reg-team-name" value={form.teamName} onChange={(e) => set("teamName", e.target.value)} placeholder="e.g. Westside Warriors" className="bg-surface-sunken border-border" />
        </Field>
        <Field label="Sport" required error={errors.sport}>
          <Select value={form.sport} onValueChange={(v) => set("sport", v)}>
            <SelectTrigger data-testid="reg-sport" className="bg-surface-sunken border-border h-10">
              <SelectValue placeholder="Choose a sport" />
            </SelectTrigger>
            <SelectContent>
              {SPORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Estimated Roster Size" optional>
            <Input
              data-testid="reg-roster-size"
              type="number"
              min="1"
              max="30"
              value={form.estimatedRosterSize}
              onChange={(e) => set("estimatedRosterSize", e.target.value)}
              placeholder="e.g. 10"
              className="bg-surface-sunken border-border"
            />
          </Field>
          <Field label="Preferred Season" optional>
            <Input value={state.settings.currentSeason} readOnly className="bg-surface-sunken border-border opacity-60 cursor-default" />
          </Field>
        </div>
        <Field label="Notes" optional>
          <Textarea
            data-testid="reg-notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Returning team, schedule preferences, anything we should know…"
            className="bg-surface-sunken border-border"
          />
        </Field>
      </div>

      {/* Consent */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox data-testid="reg-consent" checked={consentToContact} onCheckedChange={setConsentToContact} className="mt-0.5" />
          <span className="text-sm text-muted-foreground leading-snug">
            I consent to be contacted by CVF Sports by phone, text, or email regarding league registration.{" "}
            <span className="text-destructive font-bold">*</span>
          </span>
        </label>
        {errors.consent && <p className="text-xs text-destructive mt-2 ml-7">{errors.consent}</p>}
      </div>

      <button
        onClick={submit}
        data-testid="reg-submit"
        className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm py-4 rounded-xl hover:bg-teal-deep transition-colors"
      >
        Submit Team Interest
      </button>
    </div>
  );
}

const Field = ({ label, required, optional, error, hint, children }) => (
  <div>
    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
      {label}
      {required && <span className="text-destructive">*</span>}
      {optional && <span className="normal-case tracking-normal font-normal text-[10px]">(optional)</span>}
    </Label>
    {hint && <p className="text-[10px] text-muted-foreground -mt-1 mb-1.5">{hint}</p>}
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);
