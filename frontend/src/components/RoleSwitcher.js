import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, CaretUp, Check, ArrowCounterClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "../components/ui/alert-dialog";
import { useRole } from "../context/RoleContext";
import { useApp } from "../context/AppStateContext";
import { ROLES, ROLE_ORDER } from "../lib/roles";

/* ============================================================================
 * DEMO ROLE PREVIEW SWITCHER  —  ADMIN-ONLY TESTING TOOL.
 * ----------------------------------------------------------------------------
 * Local mock tool for previewing role-specific surfaces without test accounts.
 * Hosted administration uses the authenticated AAL2 session instead. This
 * component is never rendered by a preview or production build.
 * ========================================================================== */

export const RoleSwitcher = () => {
  const { role, setRole, roleMeta } = useRole();
  const { resetState } = useApp();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSelect = (id) => {
    setRole(id);
    // Send the previewer somewhere sensible for the newly selected role.
    if (id === "admin") navigate("/admin");
    else if (id === "temp_admin") navigate("/score-entry");
    else if (id === "captain") navigate("/free-agents");
    else if (id === "player") navigate("/profile/me");
    else navigate("/");
  };

  return (
    <div className="fixed z-50 left-4 bottom-20 md:left-6 md:bottom-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-testid="role-switcher"
            className="flex items-center gap-2 bg-white text-ink pl-3 pr-3.5 py-2 rounded-full shadow-floating ring-2 ring-primary/40 hover:scale-105 active:scale-95 transition-transform"
          >
            <Eye size={16} weight="bold" />
            <span className="flex flex-col items-start leading-none">
              <span className="text-[9px] font-bold uppercase tracking-widest text-black/50">
                Demo Preview
              </span>
              <span className="text-sm font-bold uppercase tracking-tight font-display text-ink">
                {roleMeta.short}
              </span>
            </span>
            <CaretUp size={14} weight="bold" className="text-black/50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          data-testid="role-switcher-menu"
          className="w-72 bg-card border-border"
        >
          <DropdownMenuLabel className="text-muted-foreground">
            <div className="flex items-center gap-2">
              <Eye size={14} weight="bold" className="text-primary" />
              <span className="uppercase tracking-widest text-[11px]">Demo Role Preview</span>
            </div>
            <p className="text-[11px] font-normal normal-case mt-1 text-muted-foreground/80">
              Testing tool only — preview what each role sees. Not a production feature.
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROLE_ORDER.map((id) => {
            const r = ROLES[id];
            const active = id === role;
            return (
              <DropdownMenuItem
                key={id}
                data-testid={`role-option-${id}`}
                onClick={() => handleSelect(id)}
                className="flex items-start gap-2.5 cursor-pointer py-2.5 focus:bg-white/5"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display uppercase tracking-tight text-sm text-white">
                      {r.label}
                    </span>
                    {active && <Check size={14} weight="bold" className="text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{r.description}</p>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="reset-demo-data"
            onSelect={(e) => { e.preventDefault(); setConfirmReset(true); }}
            className="flex items-center gap-2.5 cursor-pointer py-2.5 focus:bg-white/5"
          >
            <ArrowCounterClockwise size={15} weight="bold" className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Reset demo data</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Destructive: clears all demo edits back to seed defaults. Confirm first. */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto" data-testid="reset-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-tight text-white">Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears every change made in this demo — scores, players, rosters, triage — and restores the original seed data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="reset-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="reset-confirm-accept"
              onClick={() => { resetState(); toast.success("Demo data reset to defaults"); navigate("/"); }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Reset data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
