import { useState } from "react";
import { PaperPlaneTilt, EnvelopeSimple, Phone } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppStateContext";
import { useRole } from "../context/RoleContext";
import { SectionHeading, EmptyState } from "../components/common/Section";
import { SportBadge, StatusBadge } from "../components/common/Badges";
import { Avatar } from "../components/common/Avatar";
import { RoleGate } from "../components/layout/RoleGate";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { SPORTS, sportName } from "../lib/statsConfig";
import { freeAgentName } from "../lib/utils";

export default function FreeAgentPool() {
  // Captain-only browse-and-invite tool. Admins manage free agents in the Admin
  // dashboard's Free Agents tab (one management surface, not two).
  return (
    <RoleGate allow={["captain"]} title="Free Agent Pool">
      <Pool />
    </RoleGate>
  );
}

function Pool() {
  const { state, setFreeAgentStatus } = useApp();
  const { roleMeta } = useRole();
  const [filter, setFilter] = useState("all");

  const agents = state.freeAgents.filter((a) => filter === "all" || a.sports.includes(filter));

  const invite = (a) => {
    setFreeAgentStatus(a.id, "contacted");
    // PHASE 2: send a real invite email + create a pending roster request.
    toast.success(`Invite sent to ${freeAgentName(a)}`, { description: roleMeta.team_id ? "They'll receive an email to join your team." : "Mock invite — wired for Phase 2 email." });
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <SectionHeading as="h1" band title="Free Agent Pool" subtitle="Players ready to fill a roster spot" />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-card border border-border h-10">
          <TabsTrigger value="all" data-testid="fa-pool-filter-all" className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">All</TabsTrigger>
          {SPORTS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} data-testid={`fa-pool-filter-${s.id}`} className="data-[state=active]:bg-secondary uppercase text-xs font-semibold">{s.name}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {agents.length ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {agents.map((a) => (
            <div key={a.id} data-testid={`free-agent-${a.id}`} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Avatar name={freeAgentName(a)} color="#5BB8CC" size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display uppercase tracking-tight text-foreground truncate text-base">{freeAgentName(a)}</p>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{a.experience}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">{a.sports.map((s) => <SportBadge key={s} sport={s} />)}</div>
                </div>
              </div>
              {a.notes && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">"{a.notes}"</p>}
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate"><EnvelopeSimple size={13} weight="bold" /> {a.email}</span>
                {a.phone && <span className="flex items-center gap-1"><Phone size={13} weight="bold" /> {a.phone}</span>}
              </div>
              <button
                onClick={() => invite(a)}
                disabled={a.status !== "new"}
                data-testid={`fa-invite-${a.id}`}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-xs py-2.5 rounded-xl hover:bg-teal-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperPlaneTilt size={14} weight="bold" /> {a.status === "contacted" ? "Invite Sent" : a.status === "new" ? "Send Invite" : a.status === "assigned" ? "Assigned" : "Archived"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={PaperPlaneTilt} title="No free agents" message={`No players available for ${filter === "all" ? "any sport" : sportName(filter)}.`} />
      )}
    </div>
  );
}
