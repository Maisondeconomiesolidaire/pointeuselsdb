import { useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  ClipboardList,
  FileText,
  RotateCcw,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { FullSpinner } from "../ui/Spinner";
import { cn } from "../../lib/cn";
import { formatDate, formatEuros } from "../../lib/format";
import { useState } from "react";

export function PointageDetailModal({
  entryId,
  onClose,
}: {
  entryId: Id<"ptTimeEntries">;
  onClose: () => void;
}) {
  const entry = useQuery(api.pointeuse.getTimeEntry, { entryId });
  const updateBillingStatus = useMutation(api.pointeuse.updateTimeEntryBillingStatus);
  const [savingStatus, setSavingStatus] = useState(false);

  async function toggleBilling(current: string) {
    setSavingStatus(true);
    try {
      await updateBillingStatus({
        entryId,
        billingStatus: current === "facture" ? "a_facturer" : "facture",
      });
    } finally {
      setSavingStatus(false);
    }
  }

  if (entry === undefined) {
    return (
      <Modal open onClose={onClose} title="Pointage">
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

  return (
    <Modal open onClose={onClose} title="Détail du pointage" className="sm:h-auto sm:max-w-2xl">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--accent)] p-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-[var(--foreground)]">{entry.projectName}</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {entry.clientName} · {formatDate(entry.date)}
            </p>
            {entry.createdBy ? (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Saisi par {entry.createdBy}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                entry.billingStatus === "facture"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700",
              )}
            >
              {entry.billingStatus === "facture" ? "Facturé" : "À facturer"}
            </span>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {formatEuros(entry.totalCost)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Temps saisi</h3>
          <div className="space-y-2">
            {entry.lines.map((line, index) => (
              <div
                key={`${line.employeeId}-${index}`}
                className="flex flex-col gap-1 rounded-lg bg-[var(--accent)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {line.employeeName}
                </span>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {line.hours} h · {formatEuros(line.hourlyRate)}/h · {formatEuros(line.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Déplacements</h3>
            {entry.travel ? (
              <div className="space-y-1 text-sm text-[var(--muted-foreground)]">
                <p>{entry.travel.roundTrips} aller-retour</p>
                <p>{entry.travel.distanceKm} km aller</p>
                <p>{(entry.travel.ratePerKm ?? 1).toFixed(2)} €/km</p>
                <p className="font-medium text-[var(--foreground)]">
                  {formatEuros(entry.travelCost)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">Aucun déplacement.</p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Résumé</h3>
            <div className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <DetailRow label="Main-d'œuvre" value={formatEuros(entry.laborCost)} />
              <DetailRow label="Déplacements" value={formatEuros(entry.travelCost)} />
              <div className="border-t border-[var(--border)] pt-2">
                <DetailRow label="Total" value={formatEuros(entry.totalCost)} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Remarques</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            {entry.notes || "Aucune remarque."}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <FileText className="h-4 w-4 text-brand-500" />
            Documents ({entry.documents.length})
          </h3>
          {entry.documents.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Aucun document rattaché.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entry.documents.map((document) =>
                document.url ? (
                  <a
                    key={document._id}
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-brand-300"
                  >
                    <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
                    {document.name}
                  </a>
                ) : null,
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          {entry.billingStatus === "facture" ? (
            <Button
              variant="secondary"
              onClick={() => toggleBilling(entry.billingStatus)}
              disabled={savingStatus}
            >
              <RotateCcw className="h-4 w-4" />
              {savingStatus ? "Mise à jour…" : "Repasser à facturer"}
            </Button>
          ) : (
            <Button onClick={() => toggleBilling(entry.billingStatus)} disabled={savingStatus}>
              <BadgeCheck className="h-4 w-4" />
              {savingStatus ? "Mise à jour…" : "Marquer facturé"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-[var(--foreground)]">{value}</span>
    </div>
  );
}
