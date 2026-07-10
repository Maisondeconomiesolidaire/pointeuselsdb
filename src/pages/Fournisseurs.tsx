import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { SearchInput, matchesSearch } from "../components/ui/SearchInput";

type Supplier = {
  _id: Id<"ptSuppliers">;
  name: string;
  supplierType?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export function Fournisseurs() {
  const suppliers = useQuery(api.pointeuse.listSuppliers);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const filteredSuppliers = useMemo(
    () =>
      (suppliers ?? []).filter((s) =>
        matchesSearch(search, [
          s.name,
          s.supplierType,
          s.contactName,
          s.email,
          s.phone,
          s.address,
        ]),
      ),
    [suppliers, search],
  );

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        description="Fournisseurs rattachables aux dépenses."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouveau fournisseur
          </Button>
        }
      />

      {suppliers === undefined ? (
        <FullSpinner />
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-8 w-8" />}
          title="Aucun fournisseur"
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouveau fournisseur
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un fournisseur, type, contact…"
            />
          </div>
          {filteredSuppliers.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-8 w-8" />}
              title="Aucun résultat"
              description={`Aucun fournisseur ne correspond à « ${search} ».`}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredSuppliers.map((s) => (
                <button
                  key={s._id}
                  onClick={() => setEditing(s as Supplier)}
              className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-brand-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[var(--foreground)]">{s.name}</p>
                <Pencil className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition group-hover:opacity-100" />
              </div>
              {s.contactName ? (
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {s.contactName}
                </p>
              ) : null}
              {s.supplierType ? (
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {s.supplierType}
                </p>
              ) : null}
              {s.phone ? (
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {s.phone}
                </p>
              ) : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {(creating || editing) && (
        <SupplierForm
          supplier={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SupplierForm({
  supplier,
  onClose,
}: {
  supplier: Supplier | null;
  onClose: () => void;
}) {
  const create = useMutation(api.pointeuse.createSupplier);
  const update = useMutation(api.pointeuse.updateSupplier);
  const remove = useMutation(api.pointeuse.deleteSupplier);
  const [name, setName] = useState(supplier?.name ?? "");
  const [supplierType, setSupplierType] = useState(supplier?.supplierType ?? "");
  const [contactName, setContactName] = useState(supplier?.contactName ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name,
      supplierType: supplierType || undefined,
      contactName: contactName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      address: address || undefined,
      notes: notes || undefined,
    };
    try {
      if (supplier) await update({ supplierId: supplier._id, ...payload });
      else await create(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!supplier) return;
    if (!confirm("Supprimer ce fournisseur ?")) return;
    await remove({ supplierId: supplier._id });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}
      className="sm:h-auto sm:max-w-lg"
    >
      <div className="space-y-4">
        <Field label="Nom" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type">
          <Input value={supplierType} onChange={(e) => setSupplierType(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact">
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Adresse">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {supplier ? (
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
