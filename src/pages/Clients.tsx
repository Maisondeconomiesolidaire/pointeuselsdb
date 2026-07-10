import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { AddressAutocomplete } from "../components/ui/AddressAutocomplete";

type Client = {
  _id: Id<"ptClients">;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
};

export function Clients() {
  const clients = useQuery(api.pointeuse.listClients);
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Donneurs d'ordre auxquels sont rattachés les projets."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouveau client
          </Button>
        }
      />

      {clients === undefined ? (
        <FullSpinner />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="Aucun client"
          description="Créez un client avant de lui associer des projets."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouveau client
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <button
              key={c._id}
              onClick={() => setEditing(c as Client)}
              className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-brand-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[var(--foreground)]">{c.name}</p>
                <Pencil className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] opacity-0 transition group-hover:opacity-100" />
              </div>
              {c.contactName ? (
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {c.contactName}
                </p>
              ) : null}
              {c.city ? (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {c.postalCode} {c.city}
                </p>
              ) : null}
              {c.phone ? (
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {c.phone}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ClientForm
          client={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ClientForm({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}) {
  const create = useMutation(api.pointeuse.createClient);
  const update = useMutation(api.pointeuse.updateClient);
  const remove = useMutation(api.pointeuse.deleteClient);
  const [name, setName] = useState(client?.name ?? "");
  const [contactName, setContactName] = useState(client?.contactName ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [postalCode, setPostalCode] = useState(client?.postalCode ?? "");
  const [city, setCity] = useState(client?.city ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name,
      contactName: contactName || undefined,
      email: email || undefined,
      phone: phone || undefined,
      address: address || undefined,
      postalCode: postalCode || undefined,
      city: city || undefined,
      notes: notes || undefined,
    };
    try {
      if (client) await update({ clientId: client._id, ...payload });
      else await create(payload);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!client) return;
    if (!confirm("Supprimer ce client ?")) return;
    try {
      await remove({ clientId: client._id });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={client ? "Modifier le client" : "Nouveau client"}
      className="sm:h-auto sm:max-w-lg"
    >
      <div className="space-y-4">
        <Field label="Nom / raison sociale" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
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
          <AddressAutocomplete
            value={address}
            onValueChange={setAddress}
            onSelect={(a) => {
              setAddress(a.address);
              setPostalCode(a.postalCode);
              setCity(a.city);
            }}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code postal">
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </Field>
          <Field label="Ville">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {client ? (
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
