import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  FileText,
  FolderKanban,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageHeader, Badge } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { AppSelect, Field, Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { AddressAutocomplete } from "../components/ui/AddressAutocomplete";
import { SearchInput, matchesSearch } from "../components/ui/SearchInput";
import { DocumentPicker, type PickedDoc } from "../components/ui/DocumentPicker";
import { cn } from "../lib/cn";
import { formatDate, formatEuros } from "../lib/format";
import { PROJECT_STATUSES, projectStatusMeta } from "../lib/labels";

type Project = {
  _id: Id<"ptProjects">;
  name: string;
  clientId: Id<"ptClients">;
  clientName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  lat?: number;
  lon?: number;
  distanceKm: number;
  travelRatePerKm?: number;
  status: "en_cours" | "termine" | "en_pause";
  notes?: string;
};

type ProjectTab = "details" | "client" | "pointages" | "depenses" | "commercial";

export function Projets() {
  const { projectId } = useParams();
  return <ProjectList initialProjectId={projectId as Id<"ptProjects"> | undefined} />;
}

function ProjectList({ initialProjectId }: { initialProjectId?: Id<"ptProjects"> }) {
  const projects = useQuery(api.pointeuse.listProjects);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"ptProjects"> | null>(
    initialProjectId ?? null,
  );

  useEffect(() => {
    setSelectedProjectId(initialProjectId ?? null);
  }, [initialProjectId]);

  const filteredProjects = useMemo(
    () =>
      (projects ?? []).filter((p) =>
        matchesSearch(search, [
          p.name,
          p.clientName,
          p.address,
          p.postalCode,
          p.city,
        ]),
      ),
    [projects, search],
  );

  return (
    <div>
      <PageHeader
        title="Projets"
        description="Chantiers rattachés à un client, avec adresse et distance base -> chantier."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouveau projet
          </Button>
        }
      />

      {projects === undefined ? (
        <FullSpinner />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="Aucun projet"
          description="Créez un projet pour commencer à pointer."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nouveau projet
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un projet, client, ville…"
            />
          </div>
          {filteredProjects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-8 w-8" />}
              title="Aucun résultat"
              description={`Aucun projet ne correspond à « ${search} ».`}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((p) => {
            const meta = projectStatusMeta(p.status);
            return (
              <button
                key={p._id}
                onClick={() => setSelectedProjectId(p._id)}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate font-semibold text-[var(--foreground)]">{p.name}</p>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">{p.clientName}</p>
                {p.city ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.postalCode} {p.city}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {p.distanceKm} km depuis la base · {(p.travelRatePerKm ?? 1).toFixed(2)} €/km
                </p>
              </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {creating ? <ProjectForm project={null} onClose={() => setCreating(false)} /> : null}
      {selectedProjectId ? (
        <ProjectDetailModal
          projectId={selectedProjectId}
          onClose={() => {
            setSelectedProjectId(null);
            if (initialProjectId) navigate("/projets");
          }}
        />
      ) : null}
    </div>
  );
}

function ProjectDetailModal({
  projectId,
  onClose,
}: {
  projectId: Id<"ptProjects">;
  onClose: () => void;
}) {
  const summary = useQuery(api.pointeuse.projectSummary, { projectId });
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<ProjectTab>("details");
  const [quoteDocs, setQuoteDocs] = useState<PickedDoc[]>([]);
  const [deliveryDocs, setDeliveryDocs] = useState<PickedDoc[]>([]);
  const [invoiceDocs, setInvoiceDocs] = useState<PickedDoc[]>([]);

  if (summary === undefined) {
    return (
      <Modal open onClose={onClose} title="Projet">
        <FullSpinner />
      </Modal>
    );
  }
  if (summary === null) {
    return (
      <Modal open onClose={onClose} title="Projet introuvable">
        <EmptyState title="Projet introuvable" description="Ce projet n'existe plus." />
      </Modal>
    );
  }

  const { project, client, entries, expenses, invoices, documents, totals } = summary;
  const meta = projectStatusMeta(project.status);
  const tabs: Array<{ key: ProjectTab; label: string }> = [
    { key: "details", label: "Détails du projet" },
    { key: "client", label: "Client" },
    { key: "pointages", label: `Pointages (${entries.length})` },
    { key: "depenses", label: `Dépenses (${expenses.length})` },
    { key: "commercial", label: "Commercial" },
  ];
  const quoteDocuments = documents.filter((d) => d.kind === "expense_quote");
  const deliveryDocuments = documents.filter((d) => d.kind === "expense_delivery_note");
  const supplierInvoiceDocuments = documents.filter((d) => d.kind === "expense_invoice");
  const otherDocuments = documents.filter(
    (d) =>
      d.kind !== "expense_quote" &&
      d.kind !== "expense_delivery_note" &&
      d.kind !== "expense_invoice",
  );

  return (
    <Modal open onClose={onClose} title={project.name}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">{project.name}</h2>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {project.clientName}
              {project.city ? ` · ${project.postalCode} ${project.city}` : ""} · {project.distanceKm} km · {(project.travelRatePerKm ?? 1).toFixed(2)} €/km
            </p>
          </div>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Modifier
          </Button>
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
          {tab === "details" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Coût main-d'œuvre" value={formatEuros(totals.laborCost)} />
                <StatCard label="Déplacements" value={formatEuros(totals.travelCost)} />
                <StatCard label="Dépenses" value={formatEuros(totals.totalExpenses)} />
                <StatCard
                  label="Facturé / en attente"
                  value={formatEuros(totals.invoiced)}
                  hint={`${formatEuros(totals.pending)} en attente`}
                />
              </div>
              <Section title="Facturation des pointages">
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  <div>
                    <p className="text-xs uppercase text-[var(--muted-foreground)]">À facturer</p>
                    <p className="mt-0.5 text-lg font-semibold text-amber-600">
                      {formatEuros(totals.toBillPointed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-[var(--muted-foreground)]">Facturé</p>
                    <p className="mt-0.5 text-lg font-semibold text-emerald-600">
                      {formatEuros(totals.billedPointed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-[var(--muted-foreground)]">Total pointé</p>
                    <p className="mt-0.5 text-lg font-semibold text-[var(--foreground)]">
                      {formatEuros(totals.totalPointed)}
                    </p>
                  </div>
                </div>
              </Section>
              <Section title="Adresse">
                <Muted>
                  {[project.address, project.postalCode, project.city].filter(Boolean).join(" ") ||
                    "Aucune adresse renseignée."}
                </Muted>
              </Section>
              <Section title="Notes">
                <Muted>{project.notes || "Aucune note."}</Muted>
              </Section>
            </div>
          ) : null}

          {tab === "client" ? (
            <Section title="Client">
              <InfoGrid
                items={[
                  ["Nom", client?.name ?? project.clientName ?? "—"],
                  ["Contact", client?.contactName ?? "—"],
                  ["Email", client?.email ?? "—"],
                  ["Téléphone", client?.phone ?? "—"],
                  [
                    "Adresse",
                    [client?.address, client?.postalCode, client?.city].filter(Boolean).join(" ") || "—",
                  ],
                  ["Notes", client?.notes ?? "—"],
                ]}
              />
            </Section>
          ) : null}

          {tab === "pointages" ? (
            <Section title={`Pointages (${entries.length})`}>
              {entries.length === 0 ? (
                <Muted>Aucun pointage sur ce projet.</Muted>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {entries.map((e) => (
                    <div key={e._id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">{formatDate(e.date)}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {e.lines.reduce((s, l) => s + l.hours, 0)} h
                            {e.travelCost > 0 ? ` · ${e.travel?.roundTrips} déplacement(s)` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge tone={e.billingStatus === "facture" ? "green" : "amber"}>
                            {e.billingStatus === "facture" ? "Facturé" : "À facturer"}
                          </Badge>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {formatEuros(e.totalCost)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                        {e.lines.map((line, index) => (
                          <span key={index}>
                            {line.employeeName} · {line.hours} h · {formatEuros(line.cost)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "depenses" ? (
            <Section title={`Dépenses (${expenses.length})`}>
              {expenses.length === 0 ? (
                <Muted>Aucune dépense.</Muted>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {expenses.map((x) => (
                    <div key={x._id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">{x.label}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {formatDate(x.date)}
                          {x.supplierName ? ` · ${x.supplierName}` : ""}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{formatEuros(x.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "commercial" ? (
            <div className="space-y-4">
              <CommercialDocuments title="Devis fournisseur" documents={quoteDocuments} />
              <DocumentPicker
                projectId={project._id}
                docs={quoteDocs}
                onChange={setQuoteDocs}
                kind="expense_quote"
                buttonLabel="Ajouter un devis"
              />
              <CommercialDocuments title="Bons de livraison fournisseur" documents={deliveryDocuments} />
              <DocumentPicker
                projectId={project._id}
                docs={deliveryDocs}
                onChange={setDeliveryDocs}
                kind="expense_delivery_note"
                buttonLabel="Ajouter un BL"
              />
              <CommercialDocuments title="Factures fournisseur" documents={supplierInvoiceDocuments} />
              <DocumentPicker
                projectId={project._id}
                docs={invoiceDocs}
                onChange={setInvoiceDocs}
                kind="expense_invoice"
                buttonLabel="Ajouter une facture fournisseur"
              />
              {invoices.length > 0 ? (
                <Section title={`Factures client (${invoices.length})`}>
                  <div className="divide-y divide-[var(--border)]">
                    {invoices.map((i) => (
                      <div key={i._id} className="flex items-center justify-between py-2.5">
                        <span className="text-sm text-[var(--foreground)]">N° {i.number}</span>
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {formatEuros(i.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}
              {otherDocuments.length > 0 ? (
                <CommercialDocuments title="Autres pièces" documents={otherDocuments} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {editing ? <ProjectForm project={project as Project} onClose={() => setEditing(false)} /> : null}
    </Modal>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-[var(--accent)] px-3 py-2">
          <p className="text-xs font-medium uppercase text-[var(--muted-foreground)]">{label}</p>
          <p className="mt-1 break-words text-sm text-[var(--foreground)]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function CommercialDocuments({
  title,
  documents,
}: {
  title: string;
  documents: Array<{ _id: string; name: string; url?: string | null }>;
}) {
  return (
    <Section title={`${title} (${documents.length})`}>
      {documents.length === 0 ? (
        <Muted>Aucun fichier.</Muted>
      ) : (
        <div className="flex flex-wrap gap-2">
          {documents.map((d) =>
            d.url ? (
              <a
                key={d._id}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-brand-300"
              >
                <Paperclip className="h-4 w-4 text-[var(--muted-foreground)]" />
                {d.name}
              </a>
            ) : null,
          )}
        </div>
      )}
    </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
        <FileText className="h-4 w-4 text-brand-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-[var(--muted-foreground)]">{children}</p>;
}

function ProjectForm({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const clients = useQuery(api.pointeuse.listClients);
  const computeDistance = useAction(api.pointeuse.computeProjectDistance);
  const create = useMutation(api.pointeuse.createProject);
  const update = useMutation(api.pointeuse.updateProject);
  const remove = useMutation(api.pointeuse.deleteProject);

  const [name, setName] = useState(project?.name ?? "");
  const [clientId, setClientId] = useState<string>(project?.clientId ?? "");
  const [address, setAddress] = useState(project?.address ?? "");
  const [postalCode, setPostalCode] = useState(project?.postalCode ?? "");
  const [city, setCity] = useState(project?.city ?? "");
  const [distanceKm, setDistanceKm] = useState(project ? String(project.distanceKm) : "");
  const [travelRatePerKm, setTravelRatePerKm] = useState(
    project ? String(project.travelRatePerKm ?? 1) : "1",
  );
  const [distanceState, setDistanceState] = useState<"idle" | "loading" | "error">("idle");
  const [distanceMessage, setDistanceMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(project?.status ?? "en_cours");
  const [notes, setNotes] = useState(project?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientOptions = useMemo(
    () => [
      { value: "", label: "Sélectionner" },
      ...(clients ?? []).map((client) => ({ value: client._id, label: client.name })),
    ],
    [clients],
  );
  const statusOptions = useMemo(
    () => PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    [],
  );

  useEffect(() => {
    const destination = [address, postalCode, city].filter(Boolean).join(" ").trim();
    if (!destination) {
      if (!project) setDistanceKm("");
      setDistanceState("idle");
      setDistanceMessage(null);
      return;
    }
    let cancelled = false;
    setDistanceState("loading");
    setDistanceMessage("Calcul depuis 4 rue de la Prairie, 60650 Lachapelle-aux-Pots...");
    const timer = window.setTimeout(() => {
      computeDistance({
        address,
        postalCode: postalCode || undefined,
        city: city || undefined,
      })
        .then((result) => {
          if (cancelled) return;
          setDistanceKm(String(result.distanceKm));
          setDistanceState("idle");
          setDistanceMessage(`${result.distanceKm} km depuis la base LSDB.`);
        })
        .catch((e) => {
          if (cancelled) return;
          setDistanceState("error");
          setDistanceMessage(e instanceof Error ? e.message : "Calcul de distance impossible.");
        });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address, city, computeDistance, postalCode, project]);

  async function submit() {
    if (!name.trim() || !clientId) {
      setError("Le nom et le client sont obligatoires.");
      return;
    }
    if (!distanceKm || distanceState === "loading") {
      setError("Attendez le calcul automatique de la distance.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name,
      clientId: clientId as Id<"ptClients">,
      address: address || undefined,
      postalCode: postalCode || undefined,
      city: city || undefined,
      distanceKm: Number(distanceKm) || 0,
      travelRatePerKm: Number(travelRatePerKm) || 1,
      status: status as Project["status"],
      notes: notes || undefined,
    };
    try {
      if (project) await update({ projectId: project._id, ...payload });
      else await create(payload);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!project) return;
    if (!confirm("Supprimer ce projet ?")) return;
    try {
      await remove({ projectId: project._id });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={project ? "Modifier le projet" : "Nouveau projet"}
      className="sm:h-auto sm:max-w-lg"
    >
      <div className="space-y-4">
        <Field label="Nom du projet" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Client" required>
          <AppSelect value={clientId} onChange={setClientId} options={clientOptions} />
        </Field>
        <Field label="Adresse du chantier" hint="Autocomplétion (Base Adresse Nationale)">
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
            <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </Field>
          <Field label="Ville">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Distance base -> chantier (km)"
            required
            hint={distanceMessage ?? "Calculée automatiquement depuis la base LSDB"}
          >
            <div className="relative">
              <Input type="number" min="0" step="0.1" value={distanceKm} readOnly className="pr-10" />
              {distanceState === "loading" ? (
                <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
              ) : null}
            </div>
            {distanceState === "error" ? <p className="mt-1 text-xs text-red-600">{distanceMessage}</p> : null}
          </Field>
          <Field label="Coût kilométrique HT (€/km)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={travelRatePerKm}
              onChange={(e) => setTravelRatePerKm(e.target.value)}
            />
          </Field>
          <Field label="Statut">
            <AppSelect
              value={status}
              onChange={(value) => setStatus(value as Project["status"])}
              options={statusOptions}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {project ? (
            <Button variant="danger" size="sm" onClick={onDelete}>
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
