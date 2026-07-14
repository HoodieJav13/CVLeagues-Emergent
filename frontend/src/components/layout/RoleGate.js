import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useRole } from "../../context/RoleContext";
import { ROLES } from "../../lib/roles";
import { BACKEND_ENABLED } from "../../lib/supabase";
import { enrollTotp, signInAdmin, signOutAdmin, verifyMfaCode } from "../../lib/backend";
import { TurnstileWidget } from "../common/TurnstileWidget";
import { Input } from "../ui/input";

export const RoleGate = ({ allow = [], children, title = "Restricted Area" }) => {
  const { role, authStatus } = useRole();
  if (allow.includes(role)) return children;
  if (BACKEND_ENABLED && allow.includes("admin")) return <AdminAccess title={title} status={authStatus} />;
  const allowed = allow.map((r) => ROLES[r]?.label).filter(Boolean).join(" or ");
  return (
    <AuthCard title={title} testId="role-gate-denied">
      <p className="text-sm text-muted-foreground">
        This area is available to <span className="text-foreground font-semibold">{allowed}</span>.
      </p>
    </AuthCard>
  );
};

function AdminAccess({ title, status }) {
  const { authError } = useRole();
  if (status === "checking") return <AuthCard title={title}><p className="text-sm text-muted-foreground">Checking administrator security…</p></AuthCard>;
  if (status === "mfa_enrollment") return <MfaEnrollment title={title} />;
  if (status === "mfa_challenge") return <MfaChallenge title={title} />;
  if (status === "unauthorized") {
    return (
      <AuthCard title="Account Not Authorized">
        <p className="text-sm text-muted-foreground">This signed-in account is not the linked CVF administrator.</p>
        <button type="button" onClick={() => signOutAdmin("local").catch((error) => toast.error(error.message))} className="auth-button">Sign Out</button>
      </AuthCard>
    );
  }
  if (status === "error") {
    return (
      <AuthCard title="Authentication Unavailable">
        <p className="text-sm text-destructive">{authError}</p>
        <button type="button" onClick={() => signOutAdmin("local").catch((error) => toast.error(error.message))} className="auth-button">Clear Session</button>
      </AuthCard>
    );
  }
  return <AdminLogin title={title} />;
}

const AuthCard = ({ title, children, testId = "admin-auth-card" }) => (
  <div data-testid={testId} className="bg-card border border-border rounded-2xl p-8 max-w-md mx-auto mt-8 space-y-4">
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
        <Lock size={22} weight="bold" className="text-primary" />
      </div>
      <p className="text-micro uppercase tracking-[0.25em] text-primary font-bold">CVF Operations</p>
      <h1 className="font-display uppercase text-heading text-foreground mt-1 mb-1">{title}</h1>
    </div>
    {children}
  </div>
);

const AdminLogin = ({ title }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!captchaToken) return toast.error("Complete human verification first.");
    setBusy(true);
    try {
      await signInAdmin(email.trim(), password, captchaToken);
      setPassword("");
    } catch (error) {
      toast.error(error.message);
      setCaptchaReset((value) => value + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} data-testid="admin-login">
      <AuthCard title={title}>
        <p className="text-sm text-muted-foreground text-center">Administrator sign-in requires password and authenticator verification.</p>
        <label className="block">
          <span className="text-label uppercase text-muted-foreground mb-1.5 block">Email</span>
          <Input data-testid="admin-login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-surface-sunken border-border" />
        </label>
        <label className="block">
          <span className="text-label uppercase text-muted-foreground mb-1.5 block">Password</span>
          <Input data-testid="admin-login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-surface-sunken border-border" />
        </label>
        <TurnstileWidget action="admin_login" onToken={setCaptchaToken} onError={toast.error} resetSignal={captchaReset} />
        <button type="submit" disabled={busy || !captchaToken} data-testid="admin-login-submit" className="auth-button">
          {busy ? "Signing in…" : "Continue"}
        </button>
        <Link to="/admin/recover" className="block text-center text-xs text-primary hover:underline">Forgot password?</Link>
      </AuthCard>
    </form>
  );
};

function MfaEnrollment({ title }) {
  const { refreshAuth } = useRole();
  const [factor, setFactor] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    setBusy(true);
    try {
      setFactor(await enrollTotp());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await verifyMfaCode(factor.id, code.trim());
      await refreshAuth();
      toast.success("Authenticator protection enabled.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title={title} testId="admin-mfa-enrollment">
      <div className="flex items-center gap-2 text-sm text-foreground"><ShieldCheck className="text-primary" size={20} /> MFA enrollment is required before admin access.</div>
      {!factor ? (
        <button type="button" onClick={begin} disabled={busy} className="auth-button">{busy ? "Starting…" : "Set Up Authenticator"}</button>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <img src={factor.totp.qr_code} alt="Authenticator QR code" className="mx-auto bg-white p-2 rounded-xl max-w-[220px]" />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Cannot scan the QR code?</summary>
            <code className="block break-all mt-2 select-all">{factor.totp.secret}</code>
          </details>
          <Input aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="bg-surface-sunken border-border" />
          <button type="submit" disabled={busy || code.trim().length < 6} className="auth-button">{busy ? "Verifying…" : "Enable MFA"}</button>
        </form>
      )}
    </AuthCard>
  );
}

function MfaChallenge({ title }) {
  const { mfaFactor, refreshAuth } = useRole();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await verifyMfaCode(mfaFactor.id, code.trim());
      await refreshAuth();
    } catch (error) {
      toast.error(error.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title={title} testId="admin-mfa-challenge">
      <p className="text-sm text-muted-foreground text-center">Enter the code from your authenticator app.</p>
      <form onSubmit={submit} className="space-y-4">
        <Input data-testid="admin-mfa-code" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="bg-surface-sunken border-border text-center tracking-[0.35em]" />
        <button type="submit" disabled={busy || code.trim().length < 6} className="auth-button">{busy ? "Verifying…" : "Verify"}</button>
      </form>
    </AuthCard>
  );
}
