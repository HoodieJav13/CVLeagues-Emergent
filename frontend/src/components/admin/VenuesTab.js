import { useState } from "react";
import { MapPin, PencilSimple, Plus, Power } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { StatusBadge } from "../common/Badges";

/* ============================================================================
 * VENUES — admin management for where games are played.
 *
 * Migration 29 made `games.venue_id` required, so an administrator must be able
 * to create a venue before a game can be scheduled at a new field. Venues are
 * NEVER deleted: historical games reference them and the database has no delete
 * policy for any client role. The lifecycle action is therefore RETIRE, which
 * hides a venue from pickers while leaving every past game intact.
 * ========================================================================== */

const blankVenue = () => ({ id: null, name: "", field_label: "", address: "", notes: "" });

export const venueDisplayName = (venue) =>
  [venue?.name, venue?.field_label].filter(Boolean).join(" · ");

// Same identity rule the database enforces: name plus field label, where a
// missing field label collides with other missing field labels.
export function isDuplicateVenue(venues, candidate) {
  const key = (name, field) => `${(name || "").trim().toLowerCase()}|${(field || "").trim().toLowerCase()}`;
  const target = key(candidate.name, candidate.field_label);
  return venues.some((venue) => venue.id !== candidate.id && key(venue.name, venue.field_label) === target);
}

export default function VenuesTab({ app }) {
  const { state, createEntity, updateEntity } = app;
  const [modal, setModal] = useState(null);

  const venues = state.venues || [];
  const gamesAt = (venue_id) => state.games.filter((game) => game.venue_id === venue_id).length;

  const save = async () => {
    if (!modal.name?.trim()) return toast.error("Venue name required");
    if (isDuplicateVenue(venues, modal)) return toast.error("A venue with that name and field already exists");

    // Optional fields are stored as null rather than empty strings so the
    // database's "no field label" case stays a single representable value.
    const patch = {
      name: modal.name.trim(),
      field_label: modal.field_label?.trim() || null,
      address: modal.address?.trim() || null,
      notes: modal.notes?.trim() || null,
    };
    try {
      if (modal.id) await updateEntity("venues", modal.id, patch);
      else await createEntity("venues", { ...patch, status: "active" }, "v");
      toast.success(modal.id ? "Venue updated" : "Venue created");
      setModal(null);
    } catch {
      // Backend errors are surfaced centrally; keep the form open for correction.
    }
  };

  const setStatus = async (venue, status) => {
    try {
      await updateEntity("venues", venue.id, { status });
      toast.success(status === "retired" ? "Venue retired" : "Venue reactivated");
    } catch { /* surfaced centrally */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <p className="font-display uppercase tracking-tight text-foreground">
          Venues <span className="text-muted-foreground font-sans text-xs normal-case">({venues.length})</span>
        </p>
        <Button variant="outline" size="sm" onClick={() => setModal(blankVenue())} data-testid="admin-add-venue">
          <Plus size={14} weight="bold" /> New Venue
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <Table data-testid="admin-venues-table">
          <TableHeader>
            <TableRow className="border-border">
              {["Venue", "Field", "Address", "Games", "Status", ""].map((head, index) => (
                <TableHead key={index} className="text-micro uppercase tracking-widest text-muted-foreground">{head}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {venues.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={6} className="text-sm text-muted-foreground py-6 text-center">
                  No venues yet. Add one before scheduling a game.
                </TableCell>
              </TableRow>
            ) : venues.map((venue) => (
              <TableRow key={venue.id} data-testid={`admin-venue-${venue.id}`} className="border-border">
                <TableCell className="text-foreground font-medium whitespace-nowrap">
                  <span className="flex items-center gap-1.5"><MapPin size={13} weight="bold" className="text-muted-foreground" />{venue.name}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{venue.field_label || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[16rem] truncate">{venue.address || "—"}</TableCell>
                <TableCell className="text-xs font-mono-score text-muted-foreground" data-testid={`admin-venue-games-${venue.id}`}>{gamesAt(venue.id)}</TableCell>
                <TableCell><StatusBadge status={venue.status === "retired" ? "archived" : "active"} /></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                    <button
                      onClick={() => setModal({
                        id: venue.id,
                        name: venue.name,
                        field_label: venue.field_label || "",
                        address: venue.address || "",
                        notes: venue.notes || "",
                      })}
                      data-testid={`admin-edit-venue-${venue.id}`}
                      title="Edit venue"
                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 inline-flex items-center justify-center"
                    >
                      <PencilSimple size={16} weight="bold" />
                    </button>
                    <button
                      onClick={() => setStatus(venue, venue.status === "retired" ? "active" : "retired")}
                      data-testid={`admin-retire-venue-${venue.id}`}
                      title={venue.status === "retired"
                        ? "Reactivate venue"
                        : "Retire venue — hides it from pickers, keeps past games"}
                      className="min-h-11 min-w-11 md:min-h-9 md:min-w-9 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 inline-flex items-center justify-center"
                    >
                      <Power size={16} weight="bold" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display uppercase">{modal?.id ? "Edit Venue" : "New Venue"}</DialogTitle>
          </DialogHeader>
          {modal && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="admin-venue-name">Name</Label>
                <Input id="admin-venue-name" data-testid="admin-venue-name" value={modal.name} placeholder="Los Altos Park"
                  onChange={(event) => setModal({ ...modal, name: event.target.value })} className="bg-surface-sunken border-border" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="admin-venue-field">Field (optional)</Label>
                <Input id="admin-venue-field" data-testid="admin-venue-field" value={modal.field_label} placeholder="Field 2"
                  onChange={(event) => setModal({ ...modal, field_label: event.target.value })} className="bg-surface-sunken border-border" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="admin-venue-address">Address (optional)</Label>
                <Input id="admin-venue-address" data-testid="admin-venue-address" value={modal.address} placeholder="10500 Lomas Blvd NE, Albuquerque, NM"
                  onChange={(event) => setModal({ ...modal, address: event.target.value })} className="bg-surface-sunken border-border" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="admin-venue-notes">Notes (optional)</Label>
                <Input id="admin-venue-notes" data-testid="admin-venue-notes" value={modal.notes} placeholder="Parking on the north side"
                  onChange={(event) => setModal({ ...modal, notes: event.target.value })} className="bg-surface-sunken border-border" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save} data-testid="admin-venue-save">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
