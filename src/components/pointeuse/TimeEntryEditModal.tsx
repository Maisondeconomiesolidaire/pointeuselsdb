import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { FullSpinner } from "../ui/Spinner";
import { AppSelect, DatePicker, Field, Input, Textarea } from "../ui/Field";
import { ClipboardList } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatDate, formatEuros, parseDateInput, toDateInputValue } from "../../lib/format";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Modification d'un pointage : projet, date, salariés (ajout ou retrait),
 * heures, déplacements et remarques. Les taux horaires déjà figés sur le
 * pointage sont conservés ; un salarié ajouté prend son taux horaire courant.
 */
export function TimeEntryEditModal({
  entryId,
  onClose,
}: {
  entryId: Id<"ptTimeEntries">;
  onClose: () => void;
}) {
  const entry = useQuery(api.pointeuse.getTimeEntry, { entryId });

  if (entry === undefined) {
    return (
      <Modal open onClose={onClose} title="Modifier le pointage">
        <FullSpinner />
      </Modal>
    );
  }
  if (entry === null) {
    return (
      <Modal open onClose={onClose} title="Pointage introuvable">
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Pointage introuvable"
          description="Ce pointage n'existe plus."
        />
      </Modal>
    );
  }
  return <EditForm entry={entry} onClose={onClose} />;
}

type Entry = NonNullable<ReturnType<typeof useQuery<typeof api.pointeuse.getTimeEntry>>>;

function EditForm({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const projects = useQuery(api.pointeuse.listProjects);
  const employees = useQuery(api.pointeuse.listEmployees);
  const updateEntry = useMutation(api.pointeuse.updateTimeEntry);

  const [projectId, setProjectId] = useState<string>(entry.projectId);
  const [date, setDate] = useState(toDateInputValue(entry.date));
  const [hours, setHours] = useState<Record<string, string>>(() =>
    Object.fromEntries(entry.lines.map((l) => [l.employeeId, String(l.hours)])),
  );
  const [travelDone, setTravelDone] = useState((entry.travel?.roundTrips ?? 0) > 0);
  const [roundTrips, setRoundTrips] = useState(
    entry.travel?.roundTrips ? String(entry.travel.roundTrips) : "",
  );
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un salarié déjà pointé reste modifiable même s'il a été désactivé depuis.
  const pointedIds = useMemo(
    () => new Set(entry.lines.map((l) => l.employeeId as string)),
    [entry.lines],
  );
  const selectableEmployees = useMemo(
    () => (employees ?? []).filter((e) => e.active || pointedIds.has(e._id)),
    [employees, pointedIds],
  );
  const snapshotRate = useMemo(
    () => new Map(entry.lines.map((l) => [l.employeeId as string, l.hourlyRate])),
    [entry.lines],
  );

  const project = (projects ?? []).find((p) => p._id === projectId) ?? null;
  const sameProject = projectId === entry.projectId;
  const distanceKm =
    (sameProject ? entry.travel?.distanceKm : undefined) ?? project?.distanceKm ?? 0;
  const ratePerKm =
    (sameProject ? entry.travel?.ratePerKm : undefined) ?? project?.travelRatePerKm ?? 1;
  const projectOptions = useMemo(
    () => [
      ...(projects ?? []).map((p) => ({ value: p._id, label: p.name, description: p.clientName })),
    ],
    [projects],
  );

  const computedLines = useMemo(
    () =>
      selectableEmployees
        .map((e) => {
          const value = Number(hours[e._id]) || 0;
          const hourlyRate = snapshotRate.get(e._id) ?? e.hourlyRate;
          return { employee: e, hours: value, hourlyRate, cost: round2(value * hourlyRate) };
        })
        .filter((l) => l.hours > 0),
    [selectableEmployees, hours, snapshotRate],
  );

  const laborCost = round2(computedLines.reduce((s, l) => s + l.cost, 0));
  const trips = travelDone ? Number(roundTrips) || 0 : 0;
  const travelCost = trips > 0 ? round2(trips * distanceKm * 2 * ratePerKm) : 0;
  const totalCost = round2(laborCost + travelCost);

  async function save() {
    if (!projectId) {
      setError("Sélectionnez un projet.");
      return;
    }
    if (computedLines.length === 0) {
      setError("Renseignez au moins un salarié avec des heures.");
      return;
    }
    if (travelDone && trips <= 0) {
      setError("Renseignez le nombre de déplacements.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateEntry({
        entryId: entry._id,
        projectId: projectId as Id<"ptProjects">,
        date: parseDateInput(date),
        lines: computedLines.map((l) => ({ employeeId: l.employee._id, hours: l.hours })),
        roundTrips: trips,
        notes: notes || "",
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Modifier le pointage" className="sm:h-auto sm:max-w-2xl">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Projet / chantier" required>
            <AppSelect value={projectId} onChange={setProjectId} options={projectOptions} />
          </Field>
          <Field label="Date" required>
            <DatePicker value={date} onChange={setDate} />
          </Field>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-[var(--foreground)]">
            Salariés et heures pointées
          </p>
          <p className="mb-2 text-xs text-[var(--muted-foreground)]">
            Mettez les heures à 0 (ou videz le champ) pour retirer un salarié du pointage.
          </p>
          {selectableEmployees.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Aucun salarié actif. Ajoutez-en dans « Salariés ».
            </p>
          ) : (
            <div className="space-y-2">
              {selectableEmployees.map((e) => {
                const hourlyRate = snapshotRate.get(e._id) ?? e.hourlyRate;
                const value = Number(hours[e._id]) || 0;
                return (
                  <div
                    key={e._id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2",
                      value > 0 ? "border-brand-300 bg-brand-500/5" : "border-[var(--border)]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {e.firstName} {e.lastName}
                        {!e.active ? (
                          <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">
                            (inactif)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {e.status} · {formatEuros(hourlyRate)}/h
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="0"
                      value={hours[e._id] ?? ""}
                      onChange={(ev) =>
                        setHours((prev) => ({ ...prev, [e._id]: ev.target.value }))
                      }
                      className="h-9 w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-right text-sm text-[var(--foreground)] focus:border-brand-500 focus:outline-none"
                    />
                    <span className="text-xs text-[var(--muted-foreground)]">h</span>
                    <span className="w-20 text-right text-sm font-medium text-[var(--foreground)]">
                      {formatEuros(round2(value * hourlyRate))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Field label="Déplacement">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setTravelDone(true);
                if (!roundTrips) setRoundTrips("1");
              }}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition",
                travelDone
                  ? "border-brand-400 bg-brand-500 text-white"
                  : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]",
              )}
            >
              Oui
            </button>
            <button
              type="button"
              onClick={() => {
                setTravelDone(false);
                setRoundTrips("");
              }}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition",
                !travelDone
                  ? "border-brand-400 bg-brand-500 text-white"
                  : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]",
              )}
            >
              Non
            </button>
          </div>
        </Field>

        {travelDone ? (
          <Field
            label="Nombre d'aller-retours"
            required
            hint={`1 déplacement = ${distanceKm} km × 2 × ${ratePerKm} €/km = ${formatEuros(
              round2(distanceKm * 2 * ratePerKm),
            )}`}
          >
            <Input
              type="number"
              min="1"
              step="1"
              value={roundTrips}
              onChange={(e) => setRoundTrips(e.target.value)}
            />
          </Field>
        ) : null}

        <Field label="Remarques" hint="Optionnel">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="space-y-1.5 rounded-xl border border-[var(--border)] p-4 text-sm">
          <SummaryRow label="Projet" value={project?.name ?? "—"} />
          <SummaryRow label="Date" value={formatDate(parseDateInput(date))} />
          <SummaryRow label="Main-d'œuvre" value={formatEuros(laborCost)} />
          <SummaryRow label="Déplacements" value={formatEuros(travelCost)} />
          <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-semibold text-[var(--foreground)]">
            <span>Total</span>
            <span>{formatEuros(totalCost)}</span>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[var(--muted-foreground)]">
      <span>{label}</span>
      <span className="text-right text-[var(--foreground)]">{value}</span>
    </div>
  );
}
