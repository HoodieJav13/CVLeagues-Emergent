import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRole } from "../context/RoleContext";
import { signOutAdmin, updateAdminPassword } from "../lib/backend";
import { Input } from "../components/ui/input";

export default function AdminResetPassword() {
  const { session, authStatus } = useRole();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const linkedAdmin = ["mfa_enrollment", "mfa_challenge", "ready"].includes(authStatus);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 12) return toast.error("Use at least 12 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    try {
      await updateAdminPassword(password);
      await signOutAdmin("global");
      toast.success("Password updated. Sign in again on every device.");
      navigate("/admin", { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (authStatus === "checking") return <p className="text-sm text-muted-foreground text-center mt-12">Validating recovery link…</p>;
  if (!session || !linkedAdmin) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-auto mt-8 text-center">
        <h1 className="font-display uppercase text-heading text-foreground">Recovery Link Required</h1>
        <p className="text-sm text-muted-foreground mt-2">This link is invalid, expired, or does not belong to the administrator.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-8 max-w-md mx-auto mt-8 space-y-4">
      <h1 className="font-display uppercase text-heading text-foreground text-center">Set New Password</h1>
      <p className="text-sm text-muted-foreground">Use a unique password with at least 12 characters. Saving revokes every existing session.</p>
      <Input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className="bg-surface-sunken border-border" />
      <Input type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm password" className="bg-surface-sunken border-border" />
      <button type="submit" disabled={busy} className="auth-button">{busy ? "Saving…" : "Update Password"}</button>
    </form>
  );
}
