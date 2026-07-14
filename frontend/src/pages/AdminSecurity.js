import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import { RoleGate } from "../components/layout/RoleGate";
import { signOutAdmin } from "../lib/backend";

export default function AdminSecurity() {
  return (
    <RoleGate allow={["admin"]} title="Admin Security">
      <SecurityPanel />
    </RoleGate>
  );
}

function SecurityPanel() {
  const navigate = useNavigate();
  const revokeOthers = async () => {
    try {
      await signOutAdmin("others");
      toast.success("All other administrator sessions were revoked.");
    } catch (error) {
      toast.error(error.message);
    }
  };
  const revokeAll = async () => {
    try {
      await signOutAdmin("global");
      toast.success("All administrator sessions were revoked.");
      navigate("/admin", { replace: true });
    } catch (error) {
      toast.error(error.message);
    }
  };
  return (
    <div className="max-w-xl mx-auto space-y-5 animate-fade-up">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <ShieldCheck size={32} className="text-primary" />
        <h1 className="font-display uppercase text-display-lg text-foreground">Admin Security</h1>
        <p className="text-sm text-muted-foreground">This session has a verified authenticator factor (AAL2). Database policies and RPCs reject password-only administrator sessions.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display uppercase text-heading text-foreground">Session Revocation</h2>
          <p className="text-sm text-muted-foreground mt-1">Use the first action after losing another device. Use the second after suspected account compromise.</p>
        </div>
        <button type="button" onClick={revokeOthers} className="auth-button">Revoke Other Sessions</button>
        <button type="button" onClick={revokeAll} className="w-full border border-destructive text-destructive font-bold uppercase tracking-wide text-sm py-3 rounded-cvf-md hover:bg-destructive/10">Revoke All Sessions</button>
      </div>
      <Link to="/admin" className="block text-center text-sm text-primary hover:underline">Back to Admin Console</Link>
    </div>
  );
}
