import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CheckCircle2, Clock, ListTodo, Plus, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { AppSelect, DatePicker, Field, Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { SearchInput, matchesSearch } from "../components/ui/SearchInput";
import { PhotoPicker, type PickedPhoto } from "../components/ui/PhotoPicker";
import { formatDate, formatEuros, parseDateInput, toDateInputValue } from "../lib/format";
import { cn } from "../lib/cn";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function Taches() {
  const tasks = useQuery(api.pointeuse.listTasks, {});
  const remove = useMutation(api.pointeuse.deleteTask);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      (tasks ?? []).filter((t) =>
        matchesSearch(search, [
          t.projectName,
          t.clientName,
          ...t.assignments.map((a) => a.employeeName),
        ]),
      ),
    [tasks, search],
  );

  return (
    <div>
      <PageHeader
        title="Tâches"
        description="Planifiez une tâche : projet, salariés affectés et temps estimé. Le temps réel est confirmé dans « Pointages »."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouvelle tâche
          </Button>
        }
      />

      {tasks === undefined ? (
        <FullSpinner />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-8 w-8" />}
          title="Aucune tâche"
          description="Créez une tâche pour affecter des salariés à un chantier."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouvelle tâche
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un projet, client, salarié…"
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="h-8 w-8" />}
              title="Aucun résultat"
              description={`Aucune tâche ne correspond à « ${search} ».`}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <div
                  key={t._id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)]">
                        {t.projectName}
                      </p>
                      <p className="truncate text-sm text-[var(--muted-foreground)]">
                        {t.clientName} · {formatDate(t.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                          t.status === "confirmed"
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                            : "border-amber-200 bg-amber-100 text-amber-700",
                        )}
                      >
                        {t.status === "confirmed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        {t.status === "confirmed" ? "Confirmée" : "En attente"}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm("Supprimer cette tâche ?")) await remove({ taskId: t._id });
                        }}
                        className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-red-600"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--muted-foreground)]">
                    {t.assignments.map((a, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5">
                        {a.confirmed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        {a.employeeName} · estimé {a.estimatedHours} h
                        {a.confirmed ? ` · réel ${a.confirmedHours} h` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--border)] pt-2 text-sm">
                    <span className="text-[var(--muted-foreground)]">
                      Estimé : <strong className="text-[var(--foreground)]">{formatEuros(t.estimatedTotal)}</strong>
                    </span>
                    <span className="text-[var(--muted-foreground)]">
                      Réel confirmé : <strong className="text-[var(--foreground)]">{formatEuros(t.confirmedTotal)}</strong>
                    </span>
                    {t.travelCost > 0 ? (
                      <span className="text-[var(--muted-foreground)]">
                        Déplacements : {formatEuros(t.travelCost)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {creating && <TaskForm onClose={() => setCreating(false)} />}
    </div>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  const projects = useQuery(api.pointeuse.listProjects);
  const employees = useQuery(api.pointeuse.listEmployees);
  const createTask = useMutation(api.pointeuse.createTask);

  const [step, setStep] = useState<1 | 2>(1);
  const [projectId, setProjectId] = useState<string>("");
  const [date, setDate] = useState(toDateInputValue(Date.now()));
  const [travelDone, setTravelDone] = useState(false);
  const [lines, setLines] = useState<Record<string, string>>({});
  const [roundTrips, setRoundTrips] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEmployees = useMemo(() => (employees ?? []).filter((e) => e.active), [employees]);
  const project = (projects ?? []).find((p) => p._id === projectId) ?? null;
  const travelRatePerKm = project?.travelRatePerKm ?? 1;
  const projectOptions = useMemo(
    () => [
      { value: "", label: "Sélectionner" },
      ...(projects ?? []).map((p) => ({ value: p._id, label: p.name, description: p.clientName })),
    ],
    [projects],
  );

  const computedLines = useMemo(() => {
    return activeEmployees
      .map((e) => {
        const hours = Number(lines[e._id]) || 0;
        return { employee: e, hours, cost: round2(hours * e.hourlyRate) };
      })
      .filter((l) => l.hours > 0);
  }, [activeEmployees, lines]);

  const laborCost = round2(computedLines.reduce((s, l) => s + l.cost, 0));
  const trips = Number(roundTrips) || 0;
  const travelCost =
    project && trips > 0 ? round2(trips * project.distanceKm * 2 * travelRatePerKm) : 0;
  const totalCost = round2(laborCost + travelCost);

  function goStep2() {
    if (!projectId) {
      setError("Sélectionnez un projet.");
      return;
    }
    if (travelDone && trips <= 0) {
      setError("Renseignez le nombre de déplacements prévus.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function save() {
    if (computedLines.length === 0) {
      setError("Affectez au moins un salarié avec un temps estimé.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTask({
        projectId: projectId as Id<"ptProjects">,
        date: parseDateInput(date),
        assignments: computedLines.map((l) => ({
          employeeId: l.employee._id,
          estimatedHours: l.hours,
        })),
        roundTrips: travelDone && trips > 0 ? trips : undefined,
        notes: notes || undefined,
        documentIds: photos.map((photo) => photo.id),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nouvelle tâche" className="sm:h-auto sm:max-w-2xl">
      <div className="mb-5 grid gap-2 text-sm sm:grid-cols-2">
        <div
          className={cn(
            "rounded-lg border px-3 py-2",
            step === 1
              ? "border-brand-300 bg-brand-500/10 text-[var(--foreground)]"
              : "border-[var(--border)] text-[var(--muted-foreground)]",
          )}
        >
          <span className="font-semibold">1.</span> Projet
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2",
            step === 2
              ? "border-brand-300 bg-brand-500/10 text-[var(--foreground)]"
              : "border-[var(--border)] text-[var(--muted-foreground)]",
          )}
        >
          <span className="font-semibold">2.</span> Salariés affectés
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Projet / chantier" required>
              <AppSelect value={projectId} onChange={setProjectId} options={projectOptions} />
            </Field>
            <Field label="Date" required>
              <DatePicker value={date} onChange={setDate} />
            </Field>
          </div>

          {project ? (
            <p className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              Client : <strong className="text-[var(--foreground)]">{project.clientName}</strong> ·
              Distance base → chantier : {project.distanceKm} km · {travelRatePerKm.toFixed(2)} €/km
            </p>
          ) : null}

          <Field label="Déplacement prévu" required>
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
              label="Nombre de déplacements"
              required
              hint={
                project
                  ? `1 déplacement = ${project.distanceKm} km × 2 × ${travelRatePerKm} €/km = ${formatEuros(
                      project.distanceKm * 2 * travelRatePerKm,
                    )}`
                  : "Sélectionnez un projet pour le calcul"
              }
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={goStep2}>Continuer</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <button
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" /> Projet et déplacement
          </button>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
              Salariés affectés et temps estimé
            </p>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                Aucun salarié actif. Ajoutez-en dans « Salariés ».
              </p>
            ) : (
              <div className="space-y-2">
                {activeEmployees.map((e) => {
                  const hours = Number(lines[e._id]) || 0;
                  return (
                    <div
                      key={e._id}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {e.firstName} {e.lastName}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {e.status} · {formatEuros(e.hourlyRate)}/h
                        </p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="0"
                        value={lines[e._id] ?? ""}
                        onChange={(ev) =>
                          setLines((prev) => ({ ...prev, [e._id]: ev.target.value }))
                        }
                        className="h-9 w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-right text-sm text-[var(--foreground)] focus:border-brand-500 focus:outline-none"
                      />
                      <span className="text-xs text-[var(--muted-foreground)]">h est.</span>
                      <span className="w-20 text-right text-sm font-medium text-[var(--foreground)]">
                        {formatEuros(round2(hours * e.hourlyRate))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Field label="Images du chantier" hint="Optionnel">
            <PhotoPicker
              projectId={projectId ? (projectId as Id<"ptProjects">) : null}
              photos={photos}
              onChange={setPhotos}
            />
          </Field>

          <Field label="Remarques" hint="Optionnel">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="space-y-1.5 rounded-xl border border-[var(--border)] p-4 text-sm">
            <Row label="Projet" value={project?.name ?? "—"} />
            <Row label="Date" value={formatDate(parseDateInput(date))} />
            <Row label="Main-d'œuvre estimée" value={formatEuros(laborCost)} />
            <Row
              label={
                travelDone
                  ? `Déplacements (${trips} × ${project?.distanceKm ?? 0} km × 2 × ${travelRatePerKm} €/km)`
                  : "Déplacements"
              }
              value={formatEuros(travelCost)}
            />
            <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-semibold text-[var(--foreground)]">
              <span>Total estimé</span>
              <span>{formatEuros(totalCost)}</span>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Créer la tâche"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[var(--muted-foreground)]">
      <span>{label}</span>
      <span className="text-right text-[var(--foreground)]">{value}</span>
    </div>
  );
}
