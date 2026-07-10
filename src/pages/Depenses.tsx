import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { AppSelect, DatePicker, Field, Input } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { DocumentPicker, type PickedDoc } from "../components/ui/DocumentPicker";
import { formatDate, formatEuros, parseDateInput, toDateInputValue } from "../lib/format";

export function Depenses() {
  const expenses = useQuery(api.pointeuse.listExpenses);
  const remove = useMutation(api.pointeuse.deleteExpense);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Dépenses"
        description="Achats et frais, rattachables à un projet et/ou un fournisseur."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouvelle dépense
          </Button>
        }
      />

      {expenses === undefined ? (
        <FullSpinner />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="Aucune dépense"
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouvelle dépense
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Libellé</th>
                <th className="px-4 py-3 font-medium">Projet</th>
                <th className="px-4 py-3 font-medium">Fournisseur</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((x) => (
                <tr
                  key={x._id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {x.label}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {x.projectName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {x.supplierName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {formatDate(x.date)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--foreground)]">
                    {formatEuros(x.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => {
                        if (confirm("Supprimer cette dépense ?"))
                          await remove({ expenseId: x._id });
                      }}
                      className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <ExpenseForm onClose={() => setCreating(false)} />}
    </div>
  );
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const projects = useQuery(api.pointeuse.listProjects);
  const suppliers = useQuery(api.pointeuse.listSuppliers);
  const create = useMutation(api.pointeuse.createExpense);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInputValue(Date.now()));
  const [projectId, setProjectId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [category, setCategory] = useState("");
  const [quoteDocs, setQuoteDocs] = useState<PickedDoc[]>([]);
  const [deliveryDocs, setDeliveryDocs] = useState<PickedDoc[]>([]);
  const [invoiceDocs, setInvoiceDocs] = useState<PickedDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const projectOptions = useMemo(
    () => [
      { value: "", label: "Aucun" },
      ...(projects ?? []).map((p) => ({ value: p._id, label: p.name })),
    ],
    [projects],
  );
  const supplierOptions = useMemo(
    () => [
      { value: "", label: "Aucun" },
      ...(suppliers ?? []).map((s) => ({ value: s._id, label: s.name })),
    ],
    [suppliers],
  );

  async function submit() {
    if (!projectId || !supplierId || !label.trim() || !amount) return;
    setSaving(true);
    try {
      await create({
        label,
        amount: Number(amount) || 0,
        date: parseDateInput(date),
        projectId: projectId as Id<"ptProjects">,
        supplierId: supplierId as Id<"ptSuppliers">,
        category: category || undefined,
        documentIds: [...quoteDocs, ...deliveryDocs, ...invoiceDocs].map((d) => d.id),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouvelle dépense"
      className="sm:h-auto sm:max-w-lg"
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Projet" required>
            <AppSelect value={projectId} onChange={setProjectId} options={projectOptions} />
          </Field>
          <Field label="Fournisseur" required>
            <AppSelect value={supplierId} onChange={setSupplierId} options={supplierOptions} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dépense" required>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Matériaux, location, sous-traitance…"
            />
          </Field>
          <Field label="Date" required>
            <DatePicker value={date} onChange={setDate} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Montant (€)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Catégorie">
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Matériaux, location, carburant…"
            />
          </Field>
        </div>

        <Field label="Devis fournisseur">
          <DocumentPicker
            projectId={projectId ? (projectId as Id<"ptProjects">) : null}
            docs={quoteDocs}
            onChange={setQuoteDocs}
            kind="expense_quote"
            buttonLabel="Ajouter un devis"
          />
        </Field>
        <Field label="BL fournisseur">
          <DocumentPicker
            projectId={projectId ? (projectId as Id<"ptProjects">) : null}
            docs={deliveryDocs}
            onChange={setDeliveryDocs}
            kind="expense_delivery_note"
            buttonLabel="Ajouter un BL"
          />
        </Field>
        <Field label="Facture fournisseur">
          <DocumentPicker
            projectId={projectId ? (projectId as Id<"ptProjects">) : null}
            docs={invoiceDocs}
            onChange={setInvoiceDocs}
            kind="expense_invoice"
            buttonLabel="Ajouter une facture fournisseur"
          />
        </Field>

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
