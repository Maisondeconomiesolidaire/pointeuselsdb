import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Loader2, Paperclip, Upload, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUpload } from "../../lib/useUpload";

export type PickedDoc = { id: Id<"ptDocuments">; name: string };
export type DocumentKind =
  | "chantier_photo"
  | "expense_quote"
  | "expense_delivery_note"
  | "expense_invoice"
  | "invoice_pdf"
  | "other";

/**
 * Sélecteur de documents : téléverse les fichiers vers le stockage Convex puis
 * les enregistre (`registerDocument`) en les rattachant au projet fourni. Les
 * documents ainsi ajoutés se retrouvent dans la fiche du projet.
 *
 * Nécessite un `projectId` (les documents portent toujours un projet). Si
 * `projectId` est absent, le sélecteur invite à choisir un projet d'abord.
 */
export function DocumentPicker({
  projectId,
  docs,
  onChange,
  kind = "other",
  buttonLabel = "Ajouter des documents",
  disabledLabel = "Sélectionnez d'abord un projet",
}: {
  projectId: Id<"ptProjects"> | null;
  docs: PickedDoc[];
  onChange: (docs: PickedDoc[]) => void;
  kind?: DocumentKind;
  buttonLabel?: string;
  disabledLabel?: string;
}) {
  const upload = useUpload();
  const registerDocument = useMutation(api.pointeuse.registerDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || !projectId) return;
    setBusy(true);
    try {
      const added: PickedDoc[] = [];
      for (const file of Array.from(files)) {
        const storageId = await upload(file);
        const id = await registerDocument({
          storageId,
          name: file.name,
          mimeType: file.type || undefined,
          kind,
          projectId,
        });
        added.push({ id, name: file.name });
      }
      onChange([...docs, ...added]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={!projectId || busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] transition hover:border-brand-300 hover:text-[var(--foreground)] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {projectId ? buttonLabel : disabledLabel}
      </button>

      {docs.length > 0 ? (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                <span className="truncate text-[var(--foreground)]">{d.name}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(docs.filter((x) => x.id !== d.id))}
                className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:text-red-600"
                aria-label="Retirer"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
