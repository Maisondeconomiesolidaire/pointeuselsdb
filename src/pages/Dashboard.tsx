import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  FolderKanban,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "../components/ui/PageHeader";
import { FullSpinner } from "../components/ui/Spinner";
import { formatEuros } from "../lib/format";

export function Dashboard() {
  const data = useQuery(api.pointeuse.dashboard);
  if (data === undefined) return <FullSpinner />;

  const cards = [
    {
      label: "Projets en cours",
      value: `${data.projectsInProgress}`,
      hint: `${data.projectsTotal} au total`,
      icon: FolderKanban,
      to: "/projets",
    },
    {
      label: "Salariés actifs",
      value: `${data.activeEmployees}`,
      icon: Users,
      to: "/salaries",
    },
    {
      label: "Pointages",
      value: `${data.entriesCount}`,
      icon: ClipboardList,
      to: "/pointages",
    },
    {
      label: "Total pointé",
      value: formatEuros(data.totalPointed),
      hint: "main-d'œuvre + déplacements",
      icon: Receipt,
      to: "/pointages",
    },
    {
      label: "Facturé",
      value: formatEuros(data.invoiced),
      hint: `${formatEuros(data.pending)} en attente`,
      icon: Wallet,
      to: "/factures",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de l'activité."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--muted-foreground)]">{c.label}</p>
              <c.icon className="h-5 w-5 text-brand-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {c.value}
            </p>
            {c.hint ? (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {c.hint}
              </p>
            ) : null}
          </Link>
        ))}
      </div>

    </div>
  );
}
