import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ChevronRight,
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
import { AppSelect, DatePicker, Field, Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { FullSpinner } from "../components/ui/Spinner";
import { AddressAutocomplete } from "../components/ui/AddressAutocomplete";
import { SearchInput, matchesSearch } from "../components/ui/SearchInput";
import { DocumentPicker, type PickedDoc } from "../components/ui/DocumentPicker";
import { PointageDetailModal } from "../components/pointeuse/PointageDetailModal";
import { cn } from "../lib/cn";
import { formatDate, formatEuros, parseDateInput, toDateInputValue } from "../lib/format";
import { CLIENT_TYPES, clientTypeMeta, INVOICE_STATUSES, PROJECT_STATUSES, projectStatusMeta } from "../lib/labels";

type Project = {
  _id: Id<"ptProjects">;
  name: string;
  clientId: Id<"ptClients">;
  clientName?: string;
  clientType?: "interne" | "externe";
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

type ProjectSummary = {
  project: Project & { clientName?: string };
  client: {
    name: string;
    clientType: "interne" | "externe";
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    notes?: string;
  } | null;
  entries: Array<{
    _id: Id<"ptTimeEntries">;
    date: number;
    laborCost: number;
    travelCost: number;
    totalCost: number;
    notes?: string;
    travel?: {
      roundTrips: number;
      distanceKm: number;
      ratePerKm?: number;
      cost: number;
    };
    billingStatus: "a_facturer" | "facture";
    lines: Array<{
      employeeId: Id<"ptEmployees">;
      hours: number;
      hourlyRate: number;
      cost: number;
      employeeName: string;
    }>;
  }>;
  expenses: Array<{
    _id: Id<"ptExpenses">;
    label: string;
    amount: number;
    date: number;
    supplierName?: string | null;
  }>;
  invoices: Array<{
    _id: Id<"ptInvoices">;
    number: string;
    amount: number;
    status: "brouillon" | "envoyee" | "payee" | "en_retard";
    issuedAt: number;
  }>;
  documents: Array<{
    _id: Id<"ptDocuments">;
    name: string;
    kind: string;
    supplierName?: string | null;
    url: string | null;
  }>;
  totals: {
    laborCost: number;
    travelCost: number;
    totalPointed: number;
    billedPointed: number;
    toBillPointed: number;
    totalExpenses: number;
    /** Pointages + déplacements + dépenses. */
    totalCost: number;
    invoiced: number;
    paid: number;
    pending: number;
  };
};

export function Projets() {
  const { projectId } = useParams();
  return <ProjectList initialProjectId={projectId as Id<"ptProjects"> | undefined} />;
}

function ProjectList({ initialProjectId }: { initialProjectId?: Id<"ptProjects"> }) {
  const projects = useQuery(api.pointeuse.listProjects);
  const clients = useQuery(api.pointeuse.listClients);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("amount_desc");
  const [activeClientId, setActiveClientId] = useState<Id<"ptClients"> | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "interne" | "externe">("all");
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"ptProjects"> | null>(
    initialProjectId ?? null,
  );

  useEffect(() => {
    setSelectedProjectId(initialProjectId ?? null);
  }, [initialProjectId]);

  const sortOptions = useMemo(
    () => [
      { value: "amount_desc", label: "Montant le plus eleve" },
      { value: "amount_asc", label: "Montant le plus faible" },
      { value: "recent", label: "Plus recent" },
      { value: "oldest", label: "Plus ancien" },
      { value: "name_asc", label: "Nom A-Z" },
      { value: "name_desc", label: "Nom Z-A" },
    ],
    [],
  );

  const filteredProjects = useMemo(() => {
    const filtered = (projects ?? []).filter((p) =>
      (typeFilter === "all" || p.clientType === typeFilter) &&
      (!activeClientId || p.clientId === activeClientId) &&
      matchesSearch(search, [p.name, p.clientName, p.address, p.postalCode, p.city]),
    );

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "amount_asc":
          return (a.totalCost ?? 0) - (b.totalCost ?? 0);
        case "recent":
          return (b.createdAt ?? b._creationTime ?? 0) - (a.createdAt ?? a._creationTime ?? 0);
        case "oldest":
          return (a.createdAt ?? a._creationTime ?? 0) - (b.createdAt ?? b._creationTime ?? 0);
        case "name_asc":
          return a.name.localeCompare(b.name, "fr");
        case "name_desc":
          return b.name.localeCompare(a.name, "fr");
        case "amount_desc":
        default:
          return (b.totalCost ?? 0) - (a.totalCost ?? 0);
      }
    });
  }, [activeClientId, projects, search, sortBy, typeFilter]);

  const matchingClients = useMemo(() => {
    if (!search.trim()) return [];
    return (clients ?? [])
      .filter((client) => {
        if (typeFilter !== "all" && client.clientType !== typeFilter) return false;
        return matchesSearch(search, [client.name, client.city, client.contactName]);
      })
      .slice(0, 6);
  }, [activeClientId, clients, search, typeFilter]);

  const selectedClient = useMemo(
    () => (clients ?? []).find((client) => client._id === activeClientId) ?? null,
    [activeClientId, clients],
  );

  useEffect(() => {
    if (!selectedClient) return;
    if (search.trim() === selectedClient.name) return;
    setActiveClientId(null);
  }, [search, selectedClient]);

  const summary = useMemo(() => {
    let totalPointed = 0;
    let billedPointed = 0;
    let toBillPointed = 0;
    let totalExpenses = 0;
    let totalCost = 0;
    let projectsInProgress = 0;
    for (const project of filteredProjects) {
      totalPointed += project.totalPointed ?? 0;
      billedPointed += project.billedPointed ?? 0;
      toBillPointed += project.toBillPointed ?? 0;
      totalExpenses += project.totalExpenses ?? 0;
      totalCost += project.totalCost ?? 0;
      if (project.status !== "termine") projectsInProgress += 1;
    }
    return {
      totalPointed,
      billedPointed,
      toBillPointed,
      totalExpenses,
      totalCost,
      projectsInProgress,
      projectsCompleted: filteredProjects.length - projectsInProgress,
    };
  }, [filteredProjects]);

  const columns = useMemo(
    () => [
      {
        key: "en_cours",
        title: "En cours",
        description: "Inclut les projets en cours et en pause.",
        projects: filteredProjects.filter((project) => project.status !== "termine"),
      },
      {
        key: "termine",
        title: "Terminée",
        description: "Projets clôturés.",
        projects: filteredProjects.filter((project) => project.status === "termine"),
      },
    ],
    [filteredProjects],
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
          <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
            <div className="space-y-2">
              <div className="max-w-md">
                <SearchInput
                  value={search}
                  onChange={(value) => setSearch(value)}
                  placeholder="Rechercher un projet, client, ville…"
                />
              </div>
              {selectedClient ? (
                <Badge tone={clientTypeMeta(selectedClient.clientType).tone}>
                  {clientTypeMeta(selectedClient.clientType).label}
                </Badge>
              ) : null}
              {matchingClients.length > 0 ? (
                <div className="max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-sm">
                  <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Clients correspondants
                  </p>
                  <div className="space-y-1">
                    {matchingClients.map((client) => (
                      <button
                        key={client._id}
                        type="button"
                        onClick={() => {
                          setActiveClientId(client._id);
                          setSearch(client.name);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-[var(--accent)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[var(--foreground)]">
                            {client.name}
                          </span>
                          <span className="block truncate text-xs text-[var(--muted-foreground)]">
                            {[client.postalCode, client.city].filter(Boolean).join(" ")}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <Field label="Type de client">
              <AppSelect
                value={typeFilter}
                onChange={(value) => setTypeFilter(value as "all" | "interne" | "externe")}
                options={[
                  { value: "all", label: "Tous les clients" },
                  ...CLIENT_TYPES.map((item) => ({
                    value: item.value,
                    label: item.label,
                  })),
                ]}
              />
            </Field>
            <Field label="Tri">
              <AppSelect value={sortBy} onChange={setSortBy} options={sortOptions} />
            </Field>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total à facturer"
              value={formatEuros(summary.totalCost)}
              hint={`${formatEuros(summary.totalPointed)} pointés · ${formatEuros(summary.totalExpenses)} dépenses`}
            />
            <StatCard
              label="Reste à facturer"
              value={formatEuros(summary.toBillPointed)}
              tone="amber"
            />
            <StatCard label="Facturé" value={formatEuros(summary.billedPointed)} tone="green" />
            <StatCard
              label="Projets visibles"
              value={String(filteredProjects.length)}
              hint={`${summary.projectsInProgress} en cours · ${summary.projectsCompleted} terminés`}
            />
          </div>
          {filteredProjects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-8 w-8" />}
              title="Aucun résultat"
              description={`Aucun projet ne correspond à « ${search} ».`}
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {columns.map((column) => (
                <section
                  key={column.key}
                  className="rounded-[28px] border border-[var(--border)] bg-[var(--card)]/80 p-4 shadow-sm backdrop-blur"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--foreground)]">
                        {column.title}
                      </h2>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {column.description}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-medium text-[var(--foreground)]">
                      {column.projects.length}
                    </span>
                  </div>
                  {column.projects.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                      Aucun projet dans cette colonne.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {column.projects.map((project) => (
                        <button
                          key={project._id}
                          onClick={() => setSelectedProjectId(project._id)}
                          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-base font-semibold text-[var(--foreground)]">
                                  {project.name}
                                </p>
                                <Badge tone={projectStatusMeta(project.status).tone}>
                                  {projectStatusMeta(project.status).label}
                                </Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm text-[var(--muted-foreground)]">
                                  {project.clientName}
                                </p>
                                <Badge tone={clientTypeMeta(project.clientType).tone}>
                                  {clientTypeMeta(project.clientType).label}
                                </Badge>
                              </div>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          </div>
                          {project.city ? (
                            <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                              <MapPin className="h-3.5 w-3.5" />
                              {project.postalCode} {project.city}
                            </p>
                          ) : null}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <CostTile
                              label="Total à facturer"
                              value={project.totalCost ?? 0}
                            />
                            <CostTile label="Pointages" value={project.laborCost ?? 0} />
                            <CostTile label="Dépenses" value={project.totalExpenses ?? 0} />
                            <CostTile label="Déplacements" value={project.travelCost ?? 0} />
                          </div>
                          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                            {project.entriesCount} pointage{project.entriesCount > 1 ? "s" : ""} ·{" "}
                            {project.expensesCount} dépense{project.expensesCount > 1 ? "s" : ""} ·{" "}
                            {project.distanceKm} km depuis la base ·{" "}
                            {(project.travelRatePerKm ?? 1).toFixed(2)} €/km
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
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
  const suppliers = useQuery(api.pointeuse.listSuppliers);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<ProjectTab>("details");
  const [quoteDocs, setQuoteDocs] = useState<PickedDoc[]>([]);
  const [deliveryDocs, setDeliveryDocs] = useState<PickedDoc[]>([]);
  const [deliverySupplierId, setDeliverySupplierId] = useState<string>("");
  const [selectedEntryId, setSelectedEntryId] = useState<Id<"ptTimeEntries"> | null>(null);
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [uploadingQuote, setUploadingQuote] = useState(false);

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

  const { project, client, entries, expenses, invoices, documents, totals } =
    summary as ProjectSummary;
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
  const lsdbInvoiceDocuments = documents.filter((d) => d.kind === "invoice_pdf");
  const supplierInvoiceDocuments = documents.filter((d) => d.kind === "expense_invoice");
  const otherDocuments = documents.filter(
    (d) =>
      d.kind !== "expense_quote" &&
      d.kind !== "expense_delivery_note" &&
      d.kind !== "expense_invoice" &&
      d.kind !== "invoice_pdf",
  );
  const supplierOptions = [
    { value: "", label: "Aucun fournisseur" },
    ...(suppliers ?? []).map((s) => ({ value: s._id, label: s.name })),
  ];

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
            <div className="mt-2">
              <Badge tone={clientTypeMeta(project.clientType).tone}>
                {clientTypeMeta(project.clientType).label}
              </Badge>
            </div>
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
                <StatCard label="Total à facturer" value={formatEuros(totals.totalCost)} />
                <StatCard label="Pointages" value={formatEuros(totals.laborCost)} />
                <StatCard label="Dépenses" value={formatEuros(totals.totalExpenses)} />
                <StatCard label="Déplacements" value={formatEuros(totals.travelCost)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Facturé / en attente"
                  value={formatEuros(totals.invoiced)}
                  hint={`${formatEuros(totals.pending)} en attente`}
                />
              </div>
              <Section title="Facturation des pointages">
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  <div>
                    <p className="text-xs uppercase text-[var(--muted-foreground)]">
                      Reste à facturer
                    </p>
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
                  ["Type", clientTypeMeta(client?.clientType).label],
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
                    <button
                      key={e._id}
                      type="button"
                      onClick={() => setSelectedEntryId(e._id)}
                      className="block w-full py-3 text-left transition hover:bg-[var(--accent)]/40"
                    >
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
                    </button>
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "depenses" ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setCreatingExpense(true)}>
                  <Plus className="h-4 w-4" /> Nouvelle dépense
                </Button>
              </div>
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

              <Section title={`Bons de livraison (${deliveryDocuments.length})`}>
                {deliveryDocuments.length === 0 ? (
                  <Muted>Aucun bon de livraison.</Muted>
                ) : (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {deliveryDocuments.map((d) =>
                      d.url ? (
                        <a
                          key={d._id}
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] hover:border-brand-300"
                        >
                          <Paperclip className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span className="min-w-0">
                            <span className="block truncate">{d.name}</span>
                            {d.supplierName ? (
                              <span className="block truncate text-xs text-[var(--muted-foreground)]">
                                {d.supplierName}
                              </span>
                            ) : null}
                          </span>
                        </a>
                      ) : null,
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Field label="Fournisseur" hint="Rattaché au bon de livraison">
                    <AppSelect
                      value={deliverySupplierId}
                      onChange={setDeliverySupplierId}
                      options={supplierOptions}
                    />
                  </Field>
                  <DocumentPicker
                    projectId={project._id}
                    docs={deliveryDocs}
                    onChange={setDeliveryDocs}
                    kind="expense_delivery_note"
                    supplierId={deliverySupplierId ? (deliverySupplierId as Id<"ptSuppliers">) : null}
                    buttonLabel="Ajouter un bon de livraison"
                  />
                </div>
              </Section>

              <CommercialDocuments title="Factures fournisseur" documents={supplierInvoiceDocuments} />
            </div>
          ) : null}

          {tab === "commercial" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setUploadingQuote(true)}>
                  <Plus className="h-4 w-4" /> Ajouter un devis LSDB
                </Button>
                <Button onClick={() => setCreatingInvoice(true)}>
                  <Plus className="h-4 w-4" /> Nouvelle facture LSDB
                </Button>
              </div>
              <CommercialDocuments title="Devis LSDB" documents={quoteDocuments} />
              <CommercialDocuments title="PDF de factures LSDB" documents={lsdbInvoiceDocuments} />
              {invoices.length > 0 ? (
                <Section title={`Factures LSDB (${invoices.length})`}>
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
      {selectedEntryId ? (
        <PointageDetailModal entryId={selectedEntryId} onClose={() => setSelectedEntryId(null)} />
      ) : null}
      {creatingExpense ? (
        <ProjectExpenseForm project={project as Project} onClose={() => setCreatingExpense(false)} />
      ) : null}
      {creatingInvoice ? (
        <ProjectInvoiceForm project={project as Project} onClose={() => setCreatingInvoice(false)} />
      ) : null}
      {uploadingQuote ? (
        <ProjectQuoteUploadModal
          project={project as Project}
          docs={quoteDocs}
          onDocsChange={setQuoteDocs}
          onClose={() => setUploadingQuote(false)}
        />
      ) : null}
    </Modal>
  );
}

function ProjectQuoteUploadModal({
  project,
  docs,
  onDocsChange,
  onClose,
}: {
  project: Project;
  docs: PickedDoc[];
  onDocsChange: (docs: PickedDoc[]) => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Ajouter un devis LSDB" className="sm:h-auto sm:max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          Le devis sera rattaché au projet <strong className="text-[var(--foreground)]">{project.name}</strong>.
        </p>
        <Field label="Document du devis">
          <DocumentPicker
            projectId={project._id}
            docs={docs}
            onChange={onDocsChange}
            kind="expense_quote"
            buttonLabel="Téléverser un devis LSDB"
          />
        </Field>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ProjectExpenseForm({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const suppliers = useQuery(api.pointeuse.listSuppliers);
  const create = useMutation(api.pointeuse.createExpense);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInputValue(Date.now()));
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState("");
  const [quoteDocs, setQuoteDocs] = useState<PickedDoc[]>([]);
  const [deliveryDocs, setDeliveryDocs] = useState<PickedDoc[]>([]);
  const [invoiceDocs, setInvoiceDocs] = useState<PickedDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "Sélectionner" },
      ...(suppliers ?? []).map((supplier) => ({ value: supplier._id, label: supplier.name })),
    ],
    [suppliers],
  );

  async function submit() {
    if (!supplierId || !label.trim() || !amount) {
      setError("Le fournisseur, le libellé et le montant sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await create({
        label,
        amount: Number(amount) || 0,
        date: parseDateInput(date),
        projectId: project._id,
        supplierId: supplierId as Id<"ptSuppliers">,
        category: category || undefined,
        documentIds: [...quoteDocs, ...deliveryDocs, ...invoiceDocs].map((doc) => doc.id),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nouvelle dépense" className="sm:h-auto sm:max-w-lg">
      <div className="space-y-4">
        <Field label="Projet">
          <Input value={project.name} readOnly />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fournisseur" required>
            <AppSelect value={supplierId} onChange={setSupplierId} options={supplierOptions} />
          </Field>
          <Field label="Date" required>
            <DatePicker value={date} onChange={setDate} />
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
        <Field label="Catégorie">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Matériaux, location, carburant…"
          />
        </Field>
        <Field label="Devis fournisseur">
          <DocumentPicker
            projectId={project._id}
            docs={quoteDocs}
            onChange={setQuoteDocs}
            kind="expense_quote"
            buttonLabel="Ajouter un devis fournisseur"
          />
        </Field>
        <Field label="BL fournisseur">
          <DocumentPicker
            projectId={project._id}
            docs={deliveryDocs}
            onChange={setDeliveryDocs}
            kind="expense_delivery_note"
            buttonLabel="Ajouter un bon de livraison"
          />
        </Field>
        <Field label="Facture fournisseur">
          <DocumentPicker
            projectId={project._id}
            docs={invoiceDocs}
            onChange={setInvoiceDocs}
            kind="expense_invoice"
            buttonLabel="Ajouter une facture fournisseur"
          />
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

function ProjectInvoiceForm({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const create = useMutation(api.pointeuse.createInvoice);
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"brouillon" | "envoyee" | "payee" | "en_retard">("brouillon");
  const [issuedAt, setIssuedAt] = useState(toDateInputValue(Date.now()));
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<PickedDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = useMemo(
    () => INVOICE_STATUSES.map((item) => ({ value: item.value, label: item.label })),
    [],
  );

  async function submit() {
    if (!number.trim() || !amount) {
      setError("Le numéro et le montant sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await create({
        projectId: project._id,
        number,
        amount: Number(amount) || 0,
        status,
        issuedAt: parseDateInput(issuedAt),
        dueAt: dueAt ? parseDateInput(dueAt) : undefined,
        notes: notes || undefined,
        documentIds: docs.map((doc) => doc.id),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nouvelle facture LSDB" className="sm:h-auto sm:max-w-lg">
      <div className="space-y-4">
        <Field label="Projet">
          <Input value={project.name} readOnly />
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
            onChange={(value) => setStatus(value as "brouillon" | "envoyee" | "payee" | "en_retard")}
            options={statusOptions}
          />
        </Field>
        <Field label="PDF de la facture LSDB">
          <DocumentPicker
            projectId={project._id}
            docs={docs}
            onChange={setDocs}
            kind="invoice_pdf"
            buttonLabel="Ajouter le PDF"
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

/**
 * Tuile de montant d'une card projet. Volontairement sans couleur d'accent :
 * les quatre tuiles (total et ses composantes) doivent se lire comme un seul
 * bloc, sans qu'une couleur laisse croire que l'une d'elles est le total.
 */
function CostTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--accent)] px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
        {formatEuros(value)}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "amber" | "green";
}) {
  const accent =
    tone === "amber"
      ? "text-amber-600"
      : tone === "green"
        ? "text-emerald-600"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", accent)}>{value}</p>
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
  const previousClientIdRef = useRef(project?.clientId ?? "");
  const clientOptions = useMemo(
    () => [
      { value: "", label: "Sélectionner" },
      ...(clients ?? []).map((client) => ({ value: client._id, label: client.name })),
    ],
    [clients],
  );
  const selectedClient = useMemo(
    () => (clients ?? []).find((client) => client._id === clientId) ?? null,
    [clientId, clients],
  );
  const statusOptions = useMemo(
    () => PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    [],
  );

  useEffect(() => {
    if (clientId === previousClientIdRef.current) return;
    previousClientIdRef.current = clientId;
    if (!selectedClient) return;
    setAddress(selectedClient.address ?? "");
    setPostalCode(selectedClient.postalCode ?? "");
    setCity(selectedClient.city ?? "");
  }, [clientId, selectedClient]);

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
