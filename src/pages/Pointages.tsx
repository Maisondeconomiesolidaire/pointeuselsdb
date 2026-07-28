import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, CheckCircle2, ClipboardList, Clock, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { SearchInput, matchesSearch } from "../components/ui/SearchInput";
import { PointageDetailModal } from "../components/pointeuse/PointageDetailModal";
import { formatDate, formatEuros } from "../lib/format";
import { cn } from "../lib/cn";

export function Pointages() {
  const tasks = useQuery(api.pointeuse.listTasks, {});
  const entries = useQuery(api.pointeuse.listTimeEntries, {});
  const remove = useMutation(api.pointeuse.deleteTimeEntry);
  const updateBillingStatus = useMutation(api.pointeuse.updateTimeEntryBillingStatus);
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<Id<"ptTimeEntries"> | null>(null);

  // Tâches encore à confirmer (au moins une affectation sans temps réel).
  const tasksToConfirm = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.assignments.some((a) => !a.confirmed))
        .filter((t) =>
          matchesSearch(search, [
            t.projectName,
            t.clientName,
            ...t.assignments.map((a) => a.employeeName),
          ]),
        ),
    [tasks, search],
  );

  const filteredEntries = useMemo(
    () =>
      (entries ?? []).filter((e) =>
        matchesSearch(search, [e.projectName, e.clientName, ...e.lines.map((l) => l.employeeName)]),
      ),
    [entries, search],
  );

  function toggleBilling(entryId: Id<"ptTimeEntries">, current: string) {
    void updateBillingStatus({
      entryId,
      billingStatus: current === "facture" ? "a_facturer" : "facture",
    });
  }

  const loading = tasks === undefined || entries === undefined;
  const empty = !loading && tasksToConfirm.length === 0 && (entries?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Pointages"
        description="Confirmez le temps réel passé sur les tâches qui vous sont affectées."
      />

      {loading ? (
        <FullSpinner />
      ) : empty ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Aucun pointage"
          description="Les tâches créées apparaîtront ici pour confirmation des heures."
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

          {tasksToConfirm.length > 0 ? (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Tâches à confirmer ({tasksToConfirm.length})
              </h2>
              <div className="space-y-3">
                {tasksToConfirm.map((t) => (
                  <TaskConfirmCard key={t._id} task={t} />
                ))}
              </div>
            </section>
          ) : null}

          {filteredEntries.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Pointages
              </h2>
              <div className="space-y-3">
                {filteredEntries.map((e) => {
                  const billed = e.billingStatus === "facture";
                  return (
                    <div
                      key={e._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedEntryId(e._id)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          setSelectedEntryId(e._id);
                        }
                      }}
                      className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-brand-300 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--foreground)]">
                            {e.projectName}
                          </p>
                          <p className="truncate text-sm text-[var(--muted-foreground)]">
                            {e.clientName} · {formatDate(e.date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleBilling(e._id, e.billingStatus);
                            }}
                            aria-pressed={billed}
                            title={billed ? "Marquer à facturer" : "Marquer facturé"}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                              billed
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-200",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border",
                                billed
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-amber-400 bg-white/70",
                              )}
                            >
                              {billed ? <Check className="h-3 w-3" /> : null}
                            </span>
                            {billed ? "Facturé" : "À facturer"}
                          </button>
                          <p className="text-lg font-semibold text-[var(--foreground)]">
                            {formatEuros(e.totalCost)}
                          </p>
                          <button
                            type="button"
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              if (confirm("Supprimer ce pointage ?")) await remove({ entryId: e._id });
                            }}
                            className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-red-600"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--muted-foreground)]">
                        {e.lines.map((l, idx) => (
                          <span key={idx}>
                            {l.employeeName} · {l.hours} h · {formatEuros(l.cost)}
                          </span>
                        ))}
                      </div>
                      {e.travelCost > 0 ? (
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          Déplacements : {e.travel?.roundTrips} A/R ·{" "}
                          {(e.travel?.ratePerKm ?? 1).toFixed(2)} €/km · {formatEuros(e.travelCost)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}

      {selectedEntryId ? (
        <PointageDetailModal
          entryId={selectedEntryId}
          onClose={() => setSelectedEntryId(null)}
        />
      ) : null}
    </div>
  );
}

type TaskItem = NonNullable<ReturnType<typeof useQuery<typeof api.pointeuse.listTasks>>>[number];

function TaskConfirmCard({ task }: { task: TaskItem }) {
  const confirmHours = useMutation(api.pointeuse.confirmTaskHours);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function confirm(employeeId: Id<"ptEmployees">, fallback: number) {
    const raw = inputs[employeeId];
    const hours = raw === undefined || raw === "" ? fallback : Number(raw);
    if (!Number.isFinite(hours) || hours < 0) return;
    setSavingId(employeeId);
    try {
      await confirmHours({ taskId: task._id, employeeId, confirmedHours: hours });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--foreground)]">{task.projectName}</p>
          <p className="truncate text-sm text-[var(--muted-foreground)]">
            {task.clientName} · {formatDate(task.date)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
          <Clock className="h-3.5 w-3.5" />
          À confirmer
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {task.assignments.map((a) => (
          <div
            key={a.employeeId}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">
                {a.employeeName}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Estimé : {a.estimatedHours} h · {formatEuros(a.hourlyRate)}/h
              </p>
            </div>
            {a.confirmed ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                {a.confirmedHours} h confirmées
              </span>
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  placeholder={String(a.estimatedHours)}
                  value={inputs[a.employeeId] ?? ""}
                  onChange={(ev) =>
                    setInputs((prev) => ({ ...prev, [a.employeeId]: ev.target.value }))
                  }
                  className="h-9 w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 text-right text-sm text-[var(--foreground)] focus:border-brand-500 focus:outline-none"
                />
                <span className="text-xs text-[var(--muted-foreground)]">h réelles</span>
                <button
                  type="button"
                  onClick={() => void confirm(a.employeeId, a.estimatedHours)}
                  disabled={savingId === a.employeeId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  Confirmer
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--border)] pt-2 text-sm text-[var(--muted-foreground)]">
        <span>
          Estimé : <strong className="text-[var(--foreground)]">{formatEuros(task.estimatedTotal)}</strong>
        </span>
        <span>
          Réel confirmé :{" "}
          <strong className="text-[var(--foreground)]">{formatEuros(task.confirmedTotal)}</strong>
        </span>
        {task.travelCost > 0 ? <span>Déplacements : {formatEuros(task.travelCost)}</span> : null}
      </div>
    </div>
  );
}
