import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { AppSelect, DatePicker, Field, Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { DocumentPicker, type PickedDoc } from "../components/ui/DocumentPicker";
import { SearchInput, matchesSearch } from "../components/ui/SearchInput";
import {
  formatDate,
  formatEuros,
  parseDateInput,
  toDateInputValue,
} from "../lib/format";
import { INVOICE_STATUSES } from "../lib/labels";

type InvoiceStatus = "brouillon" | "envoyee" | "payee" | "en_retard";

export function Factures() {
  const invoices = useQuery(api.pointeuse.listInvoices);
  const updateStatus = useMutation(api.pointeuse.updateInvoiceStatus);
  const remove = useMutation(api.pointeuse.deleteInvoice);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const filteredInvoices = useMemo(
    () =>
      (invoices ?? []).filter((i) =>
        matchesSearch(search, [i.number, i.projectName, i.clientName]),
      ),
    [invoices, search],
  );

  return (
    <div>
      <PageHeader
        title="Factures"
        description="Suivi manuel des factures par projet."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouvelle facture
          </Button>
        }
      />

      {invoices === undefined ? (
        <FullSpinner />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Aucune facture"
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouvelle facture
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher une facture, projet, client…"
            />
          </div>
          {filteredInvoices.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="Aucun résultat"
              description={`Aucune facture ne correspond à « ${search} ».`}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">N°</th>
                    <th className="px-4 py-3 font-medium">Projet</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Émise</th>
                    <th className="px-4 py-3 text-right font-medium">Montant</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((i) => {
                return (
                  <tr
                    key={i._id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                      {i.number}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {i.projectName}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {i.clientName}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {formatDate(i.issuedAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--foreground)]">
                      {formatEuros(i.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <AppSelect
                        value={i.status}
                        onChange={(value) =>
                          updateStatus({
                            invoiceId: i._id,
                            status: value as InvoiceStatus,
                          })
                        }
                        options={INVOICE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                        className="h-9 min-w-[8rem] text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={async () => {
                          if (confirm("Supprimer cette facture ?"))
                            await remove({ invoiceId: i._id });
                        }}
                        className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {creating && <InvoiceForm onClose={() => setCreating(false)} />}
    </div>
  );
}

function InvoiceForm({ onClose }: { onClose: () => void }) {
  const projects = useQuery(api.pointeuse.listProjects);
  const create = useMutation(api.pointeuse.createInvoice);
  const [projectId, setProjectId] = useState<string>("");
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("brouillon");
  const [issuedAt, setIssuedAt] = useState(toDateInputValue(Date.now()));
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<PickedDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectOptions = useMemo(
    () => [
      { value: "", label: "Sélectionner" },
      ...(projects ?? []).map((p) => ({
        value: p._id,
        label: p.name,
        description: p.clientName,
      })),
    ],
    [projects],
  );
  const statusOptions = useMemo(
    () => INVOICE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    [],
  );

  async function submit() {
    if (!projectId || !number.trim() || !amount) {
      setError("Projet, numéro et montant sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await create({
        projectId: projectId as Id<"ptProjects">,
        number,
        amount: Number(amount) || 0,
        status,
        issuedAt: parseDateInput(issuedAt),
        dueAt: dueAt ? parseDateInput(dueAt) : undefined,
        notes: notes || undefined,
        documentIds: docs.map((d) => d.id),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouvelle facture"
      className="sm:h-auto sm:max-w-lg"
    >
      <div className="space-y-4">
        <Field label="Projet" required>
          <AppSelect value={projectId} onChange={setProjectId} options={projectOptions} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Numéro" required>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <Field label="Montant (€)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date d'émission" required>
            <DatePicker value={issuedAt} onChange={setIssuedAt} />
          </Field>
          <Field label="Échéance">
            <DatePicker value={dueAt} onChange={setDueAt} placeholder="Aucune échéance" />
          </Field>
        </div>
        <Field label="Statut">
          <AppSelect
            value={status}
            onChange={(value) => setStatus(value as InvoiceStatus)}
            options={statusOptions}
          />
        </Field>
        <Field label="PDF de la facture" hint="Rattaché au projet">
          <DocumentPicker
            projectId={projectId ? (projectId as Id<"ptProjects">) : null}
            docs={docs}
            onChange={setDocs}
          />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
