import { useMemo, useState } from "react";
import { CurrencyDollar, DownloadSimple, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getLeague, getProfile, getTeam } from "../../lib/selectors";
import { balanceForCharge, balanceStatus, buildPaymentsCsv, formatCents, paidCentsForCharge, parseDollarsToCents } from "../../lib/payments";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Textarea } from "../ui/textarea";

const emptyCharge = (season) => ({ id: null, owner_type: "team", owner_id: "", season, kind: "league_registration", amount: "", notes: "" });
const emptyPayment = (chargeId) => ({ id: null, charge_id: chargeId, amount: "", method: "", paid_at: toLocalInput(new Date()), note: "" });
const EMPTY_LIST = [];

function toLocalInput(value) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function ownerName(state, charge) {
  if (charge.team_id) return getTeam(state, charge.team_id)?.name || "Unknown team";
  return getProfile(state, charge.profile_id)?.name || "Unknown player";
}

const statusClasses = {
  unpaid: "border-destructive/50 bg-destructive/10 text-destructive",
  partial: "border-gold/50 bg-gold/10 text-gold",
  paid: "border-primary/50 bg-primary/10 text-primary",
  credit: "border-secondary/50 bg-secondary/10 text-secondary",
};

const BalanceBadge = ({ status }) => (
  <span className={`inline-flex rounded-full border px-2 py-0.5 text-micro font-bold uppercase tracking-wide ${statusClasses[status]}`}>
    {status}
  </span>
);

export default function PaymentsTab({ app }) {
  const { state, createEntity, updateEntity, deleteEntity } = app;
  const charges = state.charges || EMPTY_LIST;
  const paymentEntries = state.paymentEntries || EMPTY_LIST;
  const defaultSeason = state.settings.current_seasons?.kickball || state.settings.current_season || state.seasons[0]?.name || "";
  const [chargeForm, setChargeForm] = useState(null);
  const [paymentForm, setPaymentForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [filters, setFilters] = useState({ season: "all", owner: "all", status: "all", search: "" });

  const filteredCharges = useMemo(() => charges
    .filter((charge) => filters.season === "all" || charge.season === filters.season)
    .filter((charge) => filters.owner === "all" || (filters.owner === "team" ? charge.team_id : charge.profile_id))
    .filter((charge) => {
      const paid = paidCentsForCharge(paymentEntries, charge.id);
      const status = balanceStatus(Number(charge.amount_due_cents) - paid, paid);
      return filters.status === "all" || status === filters.status;
    })
    .filter((charge) => {
      const needle = filters.search.trim().toLowerCase();
      return !needle || ownerName(state, charge).toLowerCase().includes(needle) || (charge.notes || "").toLowerCase().includes(needle);
    })
    .sort((a, b) => {
      const balanceDiff = balanceForCharge(b, paymentEntries) - balanceForCharge(a, paymentEntries);
      return balanceDiff || String(b.created_at || "").localeCompare(String(a.created_at || ""));
    }), [charges, paymentEntries, filters, state]);

  const totals = useMemo(() => filteredCharges.reduce((sum, charge) => {
    const paid = paidCentsForCharge(paymentEntries, charge.id);
    return { due: sum.due + Number(charge.amount_due_cents || 0), paid: sum.paid + paid };
  }, { due: 0, paid: 0 }), [filteredCharges, paymentEntries]);

  const openCharge = (charge = null) => {
    if (!charge) return setChargeForm(emptyCharge(defaultSeason));
    setChargeForm({
      id: charge.id,
      owner_type: charge.team_id ? "team" : "player",
      owner_id: charge.team_id || charge.profile_id,
      season: charge.season,
      kind: charge.kind,
      amount: (Number(charge.amount_due_cents) / 100).toFixed(2),
      notes: charge.notes || "",
    });
  };

  const saveCharge = async () => {
    const amount_due_cents = parseDollarsToCents(chargeForm.amount);
    if (!chargeForm.season || !chargeForm.owner_id || amount_due_cents == null) return toast.error("Season, owner, and a valid dollar amount are required.");
    const row = {
      season: chargeForm.season,
      kind: chargeForm.kind,
      amount_due_cents,
      notes: chargeForm.notes.trim() || null,
      team_id: chargeForm.owner_type === "team" ? chargeForm.owner_id : null,
      profile_id: chargeForm.owner_type === "player" ? chargeForm.owner_id : null,
    };
    try {
      if (chargeForm.id) await updateEntity("charges", chargeForm.id, row);
      else await createEntity("charges", row, "charge");
      toast.success(chargeForm.id ? "Charge corrected" : "Charge created");
      setChargeForm(null);
    } catch { /* backend action surfaces details */ }
  };

  const openPayment = (charge, entry = null) => setPaymentForm(entry ? {
    id: entry.id,
    charge_id: entry.charge_id,
    amount: (Number(entry.amount_cents) / 100).toFixed(2),
    method: entry.method || "",
    paid_at: toLocalInput(entry.paid_at),
    note: entry.note || "",
  } : emptyPayment(charge.id));

  const savePayment = async () => {
    const amount_cents = parseDollarsToCents(paymentForm.amount);
    if (!amount_cents || !paymentForm.paid_at) return toast.error("A positive amount and payment date are required.");
    const row = {
      charge_id: paymentForm.charge_id,
      amount_cents,
      method: paymentForm.method.trim() || null,
      paid_at: new Date(paymentForm.paid_at).toISOString(),
      note: paymentForm.note.trim() || null,
    };
    try {
      if (paymentForm.id) await updateEntity("paymentEntries", paymentForm.id, row);
      else await createEntity("paymentEntries", row, "payment");
      toast.success(paymentForm.id ? "Payment corrected" : "Payment recorded");
      setPaymentForm(null);
    } catch { /* backend action surfaces details */ }
  };

  const removeCharge = (charge) => {
    const entries = paymentEntries.filter((entry) => entry.charge_id === charge.id);
    if (entries.length) return toast.error("Delete this charge's payment entries first.");
    setConfirm({
      title: "Delete charge?",
      description: `This removes the ${formatCents(charge.amount_due_cents)} charge for ${ownerName(state, charge)}.`,
      action: async () => { await deleteEntity("charges", charge.id); toast.success("Charge deleted"); },
    });
  };

  const removePayment = (entry) => setConfirm({
    title: "Delete payment entry?",
    description: `This correctable ledger entry of ${formatCents(entry.amount_cents)} will be removed and the balance will recalculate immediately.`,
    action: async () => { await deleteEntity("paymentEntries", entry.id); toast.success("Payment entry deleted"); },
  });

  const exportCsv = () => {
    const csv = buildPaymentsCsv({ charges: filteredCharges, paymentEntries, ownerName: (charge) => ownerName(state, charge) });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cvf-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Payments CSV exported");
  };

  return (
    <div className="space-y-4" data-testid="admin-payments">
      <div className="rounded-xl border border-primary/30 bg-card p-4">
        <p className="font-display uppercase tracking-tight text-foreground">Manual Registration Ledger</p>
        <p className="mt-1 text-xs text-muted-foreground">Admin-only bookkeeping. Registrations do not create charges automatically—add one only when you intend to track it. Charges and payment entries are intentionally correctable; balances are derived from the current entries. This is not an append-only legal record and does not process money.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Charged" value={formatCents(totals.due)} />
        <Summary label="Received" value={formatCents(totals.paid)} />
        <Summary label="Net Balance" value={formatCents(totals.due - totals.paid)} emphasis={totals.due - totals.paid > 0} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-end">
        <Filter label="Season" value={filters.season} onChange={(season) => setFilters({ ...filters, season })}>
          <SelectItem value="all">All seasons</SelectItem>
          {state.seasons.map((season) => <SelectItem key={season.name} value={season.name}>{season.name}</SelectItem>)}
        </Filter>
        <Filter label="Owner" value={filters.owner} onChange={(owner) => setFilters({ ...filters, owner })}>
          <SelectItem value="all">Teams + players</SelectItem><SelectItem value="team">Teams</SelectItem><SelectItem value="player">Players</SelectItem>
        </Filter>
        <Filter label="Balance" value={filters.status} onChange={(status) => setFilters({ ...filters, status })}>
          <SelectItem value="all">All balances</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="credit">Credit</SelectItem>
        </Filter>
        <div className="min-w-48 flex-1"><Label className="mb-1 block text-micro uppercase tracking-widest text-muted-foreground">Search</Label><Input data-testid="payments-search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Owner or notes" className="bg-surface-sunken border-border" /></div>
        <Button variant="outline" onClick={exportCsv} disabled={!filteredCharges.length}><DownloadSimple size={16} /> Export CSV</Button>
        <Button onClick={() => openCharge()} data-testid="payments-add-charge"><Plus size={16} /> Add Charge</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow className="border-border hover:bg-transparent"><TableHead>Owner</TableHead><TableHead>Season / Kind</TableHead><TableHead className="text-right">Due</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {!filteredCharges.length ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No charges match these filters.</TableCell></TableRow> : filteredCharges.map((charge) => {
              const entries = paymentEntries.filter((entry) => entry.charge_id === charge.id).sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)));
              const paid = paidCentsForCharge(entries, charge.id);
              const balance = Number(charge.amount_due_cents) - paid;
              const status = balanceStatus(balance, paid);
              return (
                <PaymentRows key={charge.id} state={state} charge={charge} entries={entries} paid={paid} balance={balance} status={status} onAdd={() => openPayment(charge)} onEditCharge={() => openCharge(charge)} onDeleteCharge={() => removeCharge(charge)} onEditPayment={(entry) => openPayment(charge, entry)} onDeletePayment={removePayment} />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ChargeDialog state={state} form={chargeForm} setForm={setChargeForm} onSave={saveCharge} />
      <PaymentDialog form={paymentForm} setForm={setPaymentForm} onSave={savePayment} />
      <ConfirmDialog confirm={confirm} setConfirm={setConfirm} />
    </div>
  );
}

const Summary = ({ label, value, emphasis }) => <div className="rounded-xl border border-border bg-card p-4"><p className="text-micro uppercase tracking-widest text-muted-foreground">{label}</p><p className={`mt-1 font-mono-score text-2xl font-bold ${emphasis ? "text-gold" : "text-foreground"}`}>{value}</p></div>;

function PaymentRows({ state, charge, entries, paid, balance, status, onAdd, onEditCharge, onDeleteCharge, onEditPayment, onDeletePayment }) {
  return (
    <>
      <TableRow className="border-border align-top" data-testid={`payment-charge-${charge.id}`}>
        <TableCell><p className="font-medium text-foreground">{ownerName(state, charge)}</p><p className="text-micro uppercase text-muted-foreground">{charge.team_id ? "Team" : "Player"}</p>{charge.notes && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{charge.notes}</p>}</TableCell>
        <TableCell><p className="whitespace-nowrap text-xs text-foreground">{charge.season}</p><p className="text-micro uppercase text-muted-foreground">{charge.kind.replaceAll("_", " ")}</p></TableCell>
        <TableCell className="text-right font-mono-score">{formatCents(charge.amount_due_cents)}</TableCell>
        <TableCell className="text-right font-mono-score">{formatCents(paid)}</TableCell>
        <TableCell className={`text-right font-mono-score ${balance > 0 ? "text-gold" : "text-foreground"}`}>{formatCents(balance)}</TableCell>
        <TableCell><BalanceBadge status={status} /></TableCell>
        <TableCell><div className="flex justify-end gap-1"><IconButton label="Add payment" onClick={onAdd} icon={CurrencyDollar} /><IconButton label="Edit charge" onClick={onEditCharge} icon={PencilSimple} /><IconButton label="Delete charge" onClick={onDeleteCharge} icon={Trash} danger disabled={entries.length > 0} /></div></TableCell>
      </TableRow>
      {entries.length > 0 && <TableRow className="border-border bg-surface-sunken/50 hover:bg-surface-sunken/50"><TableCell colSpan={7} className="px-4 py-2"><div className="space-y-1">{entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-xs"><span className="font-mono-score text-primary">{formatCents(entry.amount_cents)}</span><span className="text-foreground">{entry.method || "Method not recorded"}</span><span className="text-muted-foreground">{new Date(entry.paid_at).toLocaleString()}</span>{entry.note && <span className="min-w-40 flex-1 text-muted-foreground">{entry.note}</span>}<IconButton label="Edit payment" onClick={() => onEditPayment(entry)} icon={PencilSimple} /><IconButton label="Delete payment" onClick={() => onDeletePayment(entry)} icon={Trash} danger /></div>)}</div></TableCell></TableRow>}
    </>
  );
}

const IconButton = ({ label, onClick, icon: Icon, danger, disabled }) => <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-25 ${danger ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}><Icon size={16} weight="bold" /></button>;

function ChargeDialog({ state, form, setForm, onSave }) {
  if (!form) return null;
  const teams = state.teams.filter((team) => getLeague(state, team.league_id)?.season === form.season);
  const owners = form.owner_type === "team" ? teams : state.profiles;
  return <Dialog open onOpenChange={(open) => !open && setForm(null)}><DialogContent className="max-h-[90vh] overflow-y-auto bg-card border-border"><DialogHeader><DialogTitle className="font-display uppercase">{form.id ? "Correct Charge" : "Add Charge"}</DialogTitle><DialogDescription>Exactly one team or player owns the charge. Team charges must use that team's season.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Filter label="Season" value={form.season} onChange={(season) => setForm({ ...form, season, owner_id: form.owner_type === "team" ? "" : form.owner_id })}>{state.seasons.map((season) => <SelectItem key={season.name} value={season.name}>{season.name}</SelectItem>)}</Filter><Filter label="Owner Type" value={form.owner_type} onChange={(owner_type) => setForm({ ...form, owner_type, owner_id: "" })}><SelectItem value="team">Team registration</SelectItem><SelectItem value="player">Individual / free agent</SelectItem></Filter><div className="sm:col-span-2"><Filter label={form.owner_type === "team" ? "Team" : "Player"} value={form.owner_id || "none"} onChange={(owner_id) => setForm({ ...form, owner_id })}>{owners.length ? owners.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>) : <SelectItem value="none" disabled>No eligible owners</SelectItem>}</Filter></div><Filter label="Charge Kind" value={form.kind} onChange={(kind) => setForm({ ...form, kind })}><SelectItem value="league_registration">League registration</SelectItem><SelectItem value="equipment">Equipment</SelectItem><SelectItem value="other">Other</SelectItem></Filter><Field label="Amount Due"><Input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="75.00" className="bg-surface-sunken border-border" /></Field><div className="sm:col-span-2"><Field label="Notes"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="bg-surface-sunken border-border" /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button onClick={onSave}>Save Charge</Button></DialogFooter></DialogContent></Dialog>;
}

function PaymentDialog({ form, setForm, onSave }) {
  if (!form) return null;
  return <Dialog open onOpenChange={(open) => !open && setForm(null)}><DialogContent className="bg-card border-border"><DialogHeader><DialogTitle className="font-display uppercase">{form.id ? "Correct Payment" : "Record Payment"}</DialogTitle><DialogDescription>Editing or deleting an entry is an intentional bookkeeping correction and immediately changes the derived balance.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Field label="Amount Received"><Input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="75.00" className="bg-surface-sunken border-border" /></Field><Field label="Method"><Input value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} placeholder="Cash, Venmo, check…" className="bg-surface-sunken border-border" /></Field><Field label="Paid At"><Input type="datetime-local" value={form.paid_at} onChange={(event) => setForm({ ...form, paid_at: event.target.value })} className="bg-surface-sunken border-border" /></Field><div className="sm:col-span-2"><Field label="Note"><Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="bg-surface-sunken border-border" /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button onClick={onSave}>Save Payment</Button></DialogFooter></DialogContent></Dialog>;
}

const ConfirmDialog = ({ confirm, setConfirm }) => <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}><AlertDialogContent className="bg-card border-border"><AlertDialogHeader><AlertDialogTitle className="font-display uppercase">{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-foreground hover:bg-destructive/90" onClick={async () => { try { await confirm.action(); } catch { /* backend action surfaces details */ } finally { setConfirm(null); } }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
const Filter = ({ label, value, onChange, children }) => <div className="min-w-40"><Label className="mb-1 block text-micro uppercase tracking-widest text-muted-foreground">{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger className="bg-surface-sunken border-border"><SelectValue /></SelectTrigger><SelectContent>{children}</SelectContent></Select></div>;
const Field = ({ label, children }) => <div><Label className="mb-1 block text-micro uppercase tracking-widest text-muted-foreground">{label}</Label>{children}</div>;
