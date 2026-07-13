import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  ChevronRight,
  FileText,
  FolderKanban,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader, Badge } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { AddressAutocomplete } from "../components/ui/AddressAutocomplete";
import { SearchInput, matchesSearch } from "../components/ui/SearchInput";
import { cn } from "../lib/cn";
import { formatDate, formatEuros } from "../lib/format";
import { invoiceStatusMeta, projectStatusMeta } from "../lib/labels";

type ClientTab = "infos" | "projets" | "factures";

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
  const [selectedClientId, setSelectedClientId] = useState<Id<"ptClients"> | null>(null);
  const [search, setSearch] = useState("");

  const filteredClients = useMemo(
    () =>
      (clients ?? []).filter((c) =>
        matchesSearch(search, [
          c.name,
          c.contactName,
          c.email,
          c.phone,
          c.postalCode,
          c.city,
        ]),
      ),
    [clients, search],
  );

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
        <>
          <div className="mb-4 max-w-md">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un client, contact, ville…"
            />
          </div>
          {filteredClients.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              title="Aucun résultat"
              description={`Aucun client ne correspond à « ${search} ».`}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredClients.map((c) => (
                <button
                  key={c._id}
                  onClick={() => setSelectedClientId(c._id)}
                  className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-semibold text-[var(--foreground)]">
                      {c.name}
                    </p>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition group-hover:translate-x-0.5" />
                  </div>
                  {c.contactName ? (
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[var(--muted-foreground)]">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      {c.contactName}
                    </p>
                  ) : null}
                  {c.city ? (
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[var(--muted-foreground)]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {c.postalCode} {c.city}
                    </p>
                  ) : null}
                  {c.phone ? (
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[var(--muted-foreground)]">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {c.phone}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedClientId ? (
        <ClientDetailModal
          clientId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
          onEdit={(client) => setEditing(client)}
        />
      ) : null}

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

function ClientDetailModal({
  clientId,
  onClose,
  onEdit,
}: {
  clientId: Id<"ptClients">;
  onClose: () => void;
  onEdit: (client: Client) => void;
}) {
  const summary = useQuery(api.pointeuse.clientSummary, { clientId });
  const navigate = useNavigate();
  const [tab, setTab] = useState<ClientTab>("infos");

  if (summary === undefined) {
    return (
      <Modal open onClose={onClose} title="Client">
        <FullSpinner />
      </Modal>
    );
  }
  if (summary === null) {
    return (
      <Modal open onClose={onClose} title="Client introuvable">
        <EmptyState title="Client introuvable" description="Ce client n'existe plus." />
      </Modal>
    );
  }

  const { client, projects, invoices, totals, counts } = summary;
  const tabs: Array<{ key: ClientTab; label: string }> = [
    { key: "infos", label: "Informations" },
    { key: "projets", label: `Projets (${counts.projects})` },
    { key: "factures", label: `Factures (${counts.invoices})` },
  ];

  return (
    <Modal open onClose={onClose} title={client.name}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold text-[var(--foreground)]">
              {client.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {counts.projects} projet{counts.projects > 1 ? "s" : ""} ·{" "}
              {counts.entries} pointage{counts.entries > 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="secondary" onClick={() => onEdit(client as Client)}>
            <Pencil className="h-4 w-4" /> Modifier
          </Button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total pointé" value={formatEuros(totals.totalPointed)} />
          <StatCard
            label="À facturer"
            value={formatEuros(totals.toBillPointed)}
            hint={`${formatEuros(totals.billedPointed)} facturé`}
          />
          <StatCard label="Dépenses" value={formatEuros(totals.totalExpenses)} />
          <StatCard
            label="Facturé / en attente"
            value={formatEuros(totals.invoiced)}
            hint={`${formatEuros(totals.pending)} en attente`}
          />
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto border-b border-[var(--border)] pb-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition",
                tab === item.key
                  ? "bg-brand-500 text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === "infos" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile icon={<User className="h-4 w-4" />} label="Contact" value={client.contactName} />
              <InfoTile icon={<Mail className="h-4 w-4" />} label="Email" value={client.email} />
              <InfoTile icon={<Phone className="h-4 w-4" />} label="Téléphone" value={client.phone} />
              <InfoTile
                icon={<MapPin className="h-4 w-4" />}
                label="Adresse"
                value={[client.address, client.postalCode, client.city].filter(Boolean).join(" ")}
              />
              <div className="sm:col-span-2">
                <InfoTile icon={<FileText className="h-4 w-4" />} label="Notes" value={client.notes} />
              </div>
            </div>
          ) : null}

          {tab === "projets" ? (
            projects.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="h-8 w-8" />}
                title="Aucun projet"
                description="Ce client n'a pas encore de projet."
              />
            ) : (
              <div className="space-y-2">
                {projects.map((p) => {
                  const meta = projectStatusMeta(p.status);
                  return (
                    <button
                      key={p._id}
                      onClick={() => {
                        onClose();
                        navigate(`/projets/${p._id}`);
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left transition hover:border-brand-300 hover:shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate font-medium text-[var(--foreground)]">
                            {p.name}
                          </p>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                          {p.city ? `${p.postalCode} ${p.city} · ` : ""}
                          {p.entriesCount} pointage{p.entriesCount > 1 ? "s" : ""} ·{" "}
                          {formatEuros(p.totalPointed)} pointé · {formatEuros(p.invoiced)} facturé
                        </p>
                        <div className="mt-2 flex items-center justify-between rounded-lg bg-[var(--accent)] px-2.5 py-2">
                          <span className="text-xs font-medium uppercase text-[var(--muted-foreground)]">
                            Reste à facturer
                          </span>
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              (p.toBillPointed ?? 0) > 0
                                ? "text-amber-600"
                                : "text-emerald-600",
                            )}
                          >
                            {formatEuros(p.toBillPointed ?? 0)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            )
          ) : null}

          {tab === "factures" ? (
            invoices.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="Aucune facture"
                description="Aucune facture rattachée à ce client."
              />
            ) : (
              <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
                {invoices.map((i) => {
                  const meta = invoiceStatusMeta(i.status);
                  return (
                    <div key={i._id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          N° {i.number} · {i.projectName}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Émise le {formatDate(i.issuedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {formatEuros(i.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg bg-[var(--accent)] px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-[var(--muted-foreground)]">
        {icon}
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-[var(--foreground)]">{value || "—"}</p>
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
