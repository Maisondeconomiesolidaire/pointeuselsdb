import { Search, X } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * Champ de recherche réutilisable pour filtrer les listes (projets, clients,
 * fournisseurs, salariés, pointages…). Filtrage côté client, insensible à la
 * casse et aux accents (cf. `matchesSearch`).
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-10 pr-10 text-[var(--foreground)] shadow-sm transition",
          "focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Effacer la recherche"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Normalise une chaîne : minuscules, sans accents, espaces compactés. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Vrai si tous les mots de la requête apparaissent dans l'un des champs fournis
 * (recherche insensible à la casse et aux accents).
 */
export function matchesSearch(
  query: string,
  fields: Array<string | number | undefined | null>,
): boolean {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeSearch(
    fields.filter((f) => f !== undefined && f !== null).join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}
