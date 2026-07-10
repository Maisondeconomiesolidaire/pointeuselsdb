import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader, Badge } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { AppSelect, Field, Input } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { formatEuros } from "../lib/format";
import { EMPLOYEE_STATUSES, type EmployeeStatus } from "../lib/labels";

type Employee = {
  _id: Id<"ptEmployees">;
  firstName: string;
  lastName: string;
  status: EmployeeStatus;
  hourlyRate: number;
  active: boolean;
};

export function Salaries() {
  const employees = useQuery(api.pointeuse.listEmployees);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Salariés"
        description="Statut et taux horaire environné de chaque salarié."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouveau salarié
          </Button>
        }
      />

      {employees === undefined ? (
        <FullSpinner />
      ) : employees.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-8 w-8" />}
          title="Aucun salarié"
          description="Ajoutez vos salariés pour pouvoir les affecter aux pointages."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouveau salarié
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-xs uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Taux horaire</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr
                  key={e._id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)]/40"
                >
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {e.firstName} {e.lastName}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {e.status}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    {formatEuros(e.hourlyRate)}/h
                  </td>
                  <td className="px-4 py-3">
                    {e.active ? (
                      <Badge tone="green">Actif</Badge>
                    ) : (
                      <Badge>Inactif</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(e as Employee)}
                      className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <EmployeeForm
          employee={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeForm({
  employee,
  onClose,
}: {
  employee: Employee | null;
  onClose: () => void;
}) {
  const create = useMutation(api.pointeuse.createEmployee);
  const update = useMutation(api.pointeuse.updateEmployee);
  const remove = useMutation(api.pointeuse.deleteEmployee);
  const [firstName, setFirstName] = useState(employee?.firstName ?? "");
  const [lastName, setLastName] = useState(employee?.lastName ?? "");
  const [status, setStatus] = useState<EmployeeStatus>(
    employee?.status ?? "Compagnon permanent",
  );
  const [hourlyRate, setHourlyRate] = useState(
    employee ? String(employee.hourlyRate) : "",
  );
  const [active, setActive] = useState(employee?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      const rate = Number(hourlyRate) || 0;
      if (employee) {
        await update({
          employeeId: employee._id,
          firstName,
          lastName,
          status,
          hourlyRate: rate,
          active,
        });
      } else {
        await create({ firstName, lastName, status, hourlyRate: rate, active });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!employee) return;
    if (!confirm("Supprimer ce salarié ?")) return;
    await remove({ employeeId: employee._id });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={employee ? "Modifier le salarié" : "Nouveau salarié"}
      className="sm:h-auto sm:max-w-lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" required>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Nom" required>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field label="Statut" required>
          <AppSelect
            value={status}
            onChange={(value) => setStatus(value as EmployeeStatus)}
            options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Taux horaire environné (€/h)" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          Salarié actif
        </label>

        <div className="flex items-center justify-between pt-2">
          {employee ? (
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
