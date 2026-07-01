import { useState, useId, cloneElement, isValidElement } from "react";
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

// Configurable availability slots — update this list to add/remove options.
const AVAILABILITY_OPTIONS = [
  { id: "sunday_morning", label: "Sunday Morning" },
  { id: "sunday_night", label: "Sunday Night" },
  { id: "monday_night", label: "Monday Night" },
];

export default function FreeAgentSignup() {
  const { addFreeAgent } = useApp();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
    phone: "",
    experience: "",
    preferredPosition: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
  });
  const [sports, setSports] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [consentToContact, setConsentToContact] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSport = (id) => setSports((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleAvail = (id) => setAvailability((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.phone.trim() && !form.email.trim()) e.contact = "Phone or email is required";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email address";
    if (!sports.length) e.sports = "Select at least one sport";
    if (!consentToContact) e.consent = "You must agree to be contacted";
    return e;
  };

  const submit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { toast.error("Please fix the highlighted fields"); return; }
    addFreeAgent({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      displayName: form.displayName.trim() || null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      sports,
      experience: form.experience || null,
      preferredPosition: form.preferredPosition.trim() || null,
      availability,
      emergencyContactName: form.emergencyContactName.trim() || null,
      emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      consentToContact: true,
      notes: form.notes.trim() || null,
    });
    // PHASE 2: POST to /free_agents + notify captains watching for that sport.
    setSubmitted(true);
    toast.success("You're in the free agent pool! Captains can now find you.");
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-10 text-center animate-fade-up" data-testid="free-agent-success">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={34} weight="fill" className="text-primary" />
        </div>
        <h1 className="font-display uppercase tracking-tight text-display-lg text-foreground">You're in the Pool!</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Captains looking for players can now find you. An admin will reach out if a captain wants to add you.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Link to="/" className="bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm px-5 py-3 rounded-xl">
            Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-up">
      <SectionHeading as="h1" title="Free Agent Sign-Up" subtitle="No team? Get found by captains." />

      {/* Personal info */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-display uppercase tracking-tight text-foreground text-sm">Your Info</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="First Name" required error={errors.firstName}>
            <Input data-testid="fa-first-name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className="bg-surface-sunken border-border" />
          </Field>
          <Field label="Last Name" required error={errors.lastName}>
            <Input data-testid="fa-last-name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className="bg-surface-sunken border-border" />
          </Field>
        </div>
        <Field label="Display Name" optional>
          <Input data-testid="fa-display-name" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Nickname or preferred name" className="bg-surface-sunken border-border" />
        </Field>
        <Field label="Contact" required error={errors.contact || errors.email} hint="At least one of phone or email is required">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input data-testid="fa-phone" aria-label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" className="bg-surface-sunken border-border" />
            <Input data-testid="fa-email" aria-label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" className="bg-surface-sunken border-border" />
          </div>
        </Field>
      </div>

      {/* Sport & availability */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-display uppercase tracking-tight text-foreground text-sm">Sport & Availability</p>
        <Field label="Sport Interest" required error={errors.sports}>
          <div role="group" aria-label="Sport interest" className="flex flex-wrap gap-2 mt-1">
            {SPORTS.map((s) => (
              <label
                key={s.id}
                data-testid={`fa-sport-${s.id}`}
                className={`flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl border cursor-pointer transition-colors ${
                  sports.includes(s.id) ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <Checkbox checked={sports.includes(s.id)} onCheckedChange={() => toggleSport(s.id)} />
                <span className="text-sm text-foreground">{s.name}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Availability" optional>
          <div role="group" aria-label="Availability" className="flex flex-wrap gap-2 mt-1">
            {AVAILABILITY_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl border cursor-pointer transition-colors ${
                  availability.includes(opt.id) ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <Checkbox checked={availability.includes(opt.id)} onCheckedChange={() => toggleAvail(opt.id)} />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Experience Level" optional>
            <Select value={form.experience} onValueChange={(v) => set("experience", v)}>
              <SelectTrigger data-testid="fa-experience" aria-label="Experience level" className="bg-surface-sunken border-border h-10">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Preferred Position" optional>
            <Input data-testid="fa-position" value={form.preferredPosition} onChange={(e) => set("preferredPosition", e.target.value)} placeholder="e.g. Pitcher, WR…" className="bg-surface-sunken border-border" />
          </Field>
        </div>
      </div>

      {/* Emergency contact */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="font-display uppercase tracking-tight text-foreground text-sm">
          Emergency Contact <span className="text-muted-foreground font-normal normal-case tracking-normal text-xs">(optional)</span>
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Contact Name" optional>
            <Input data-testid="fa-ec-name" value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} className="bg-surface-sunken border-border" />
          </Field>
          <Field label="Contact Phone" optional>
            <Input data-testid="fa-ec-phone" value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} className="bg-surface-sunken border-border" />
          </Field>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <Field label="Notes" optional>
          <Textarea
            data-testid="fa-notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything captains should know — schedule notes, positions, etc."
            className="bg-surface-sunken border-border"
          />
        </Field>
      </div>

      {/* Consent */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
          <Checkbox data-testid="fa-consent" checked={consentToContact} onCheckedChange={setConsentToContact} className="mt-0.5" />
          <span className="text-sm text-muted-foreground leading-snug">
            I consent to be contacted by CVF Sports by phone, text, or email regarding league participation.{" "}
            <span className="text-destructive font-bold">*</span>
          </span>
        </label>
        {errors.consent && <p className="text-xs text-destructive mt-2 ml-7">{errors.consent}</p>}
      </div>

      <button
        onClick={submit}
        data-testid="fa-submit"
        className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide text-sm py-4 rounded-xl hover:bg-teal-deep transition-colors"
      >
        Join Free Agent Pool
      </button>
    </div>
  );
}

// Associates the visible label with a single Input/Textarea child via a
// generated id (htmlFor/id). Grouped controls (checkbox sets, the phone+email
// pair, Select) carry their own aria-label/label and are passed through as-is.
const Field = ({ label, required, optional, error, hint, children }) => {
  const id = useId();
  const labelable = isValidElement(children) && (children.type === Input || children.type === Textarea);
  return (
    <div>
      <Label htmlFor={labelable ? id : undefined} className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {optional && <span className="normal-case tracking-normal font-normal text-[10px]">(optional)</span>}
      </Label>
      {hint && <p className="text-[10px] text-muted-foreground -mt-1 mb-1.5">{hint}</p>}
      {labelable ? cloneElement(children, { id }) : children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
};
