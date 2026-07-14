import { useState } from "react";
import { Link } from "react-router-dom";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { TurnstileWidget } from "../components/common/TurnstileWidget";
import { Input } from "../components/ui/input";
import { requestAdminPasswordReset } from "../lib/backend";

export default function AdminRecovery() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!captchaToken) return toast.error("Complete human verification first.");
    setBusy(true);
    try {
      await requestAdminPasswordReset(email.trim(), captchaToken);
      setSent(true);
    } catch (error) {
      toast.error(error.message);
      setCaptchaReset((value) => value + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-auto mt-8 space-y-4">
      <EnvelopeSimple size={36} className="text-primary mx-auto" />
      <h1 className="font-display uppercase text-heading text-foreground text-center">Admin Recovery</h1>
      {sent ? (
        <p className="text-sm text-muted-foreground text-center">If that address belongs to the administrator, a recovery link has been sent.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">Request a one-time password reset link for the administrator account.</p>
          <Input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" className="bg-surface-sunken border-border" />
          <TurnstileWidget action="admin_recovery" onToken={setCaptchaToken} onError={toast.error} resetSignal={captchaReset} />
          <button type="submit" disabled={busy || !captchaToken} className="auth-button">{busy ? "Sending…" : "Send Recovery Link"}</button>
        </form>
      )}
      <Link to="/admin" className="block text-center text-xs text-primary hover:underline">Return to admin sign-in</Link>
    </div>
  );
}
