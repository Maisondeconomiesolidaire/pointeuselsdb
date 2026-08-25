import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { FileText, ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUpload } from "../../lib/useUpload";

export type PickedAttachment = {
  id: Id<"ptDocuments">;
  name: string;
  mimeType?: string;
  /** Renseigné pour les pièces déjà enregistrées : permet de les ouvrir. */
  url?: string | null;
};

/** Taille maximale d'une pièce jointe (le stockage Convex accepte bien plus,
 *  mais au-delà l'envoi depuis un téléphone sur chantier échoue en pratique). */
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

function isImage(mimeType?: string) {
  return Boolean(mimeType?.startsWith("image/"));
}

/**
 * Pièces jointes d'une tâche ou d'un pointage : photos de chantier, bons de
 * livraison, devis signés… Contrairement à un simple sélecteur de photos, tous
 * les types de fichiers sont acceptés — sur chantier, le justificatif est
 * souvent un PDF reçu par mail.
 *
 * Le fichier est envoyé et enregistré immédiatement (`registerDocument`), puis
 * rattaché à la tâche ou au pointage à l'enregistrement du formulaire.
 */
export function AttachmentPicker({
  projectId,
  attachments,
  onChange,
  label,
}: {
  projectId: Id<"ptProjects"> | null;
  attachments: PickedAttachment[];
  onChange: (attachments: PickedAttachment[]) => void;
  label?: string;
}) {
  const upload = useUpload();
  const registerDocument = useMutation(api.pointeuse.registerDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      const added: PickedAttachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE_BYTES) {
          setError(`« ${file.name} » dépasse 20 Mo et n'a pas été ajouté.`);
          continue;
        }
        const storageId = await upload(file);
        const name = file.name || "Pièce jointe";
        const id = await registerDocument({
          storageId,
          name,
          mimeType: file.type || undefined,
          // Une photo reste une photo de chantier ; le reste est un document.
          kind: file.type.startsWith("image/") ? "chantier_photo" : "other",
          projectId,
        });
        added.push({ id, name, mimeType: file.type || undefined });
      }
      if (added.length > 0) onChange([...attachments, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
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
        onChange={(e) => void onFiles(e.target.files)}
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
          <Paperclip className="h-4 w-4" />
        )}
        {projectId
          ? label ?? "Ajouter des pièces jointes"
          : "Sélectionnez d'abord un projet"}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                {isImage(attachment.mimeType) ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                )}
                {attachment.url ? (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[var(--foreground)] underline underline-offset-2"
                  >
                    {attachment.name}
                  </a>
                ) : (
                  <span className="truncate text-[var(--foreground)]">{attachment.name}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onChange(attachments.filter((x) => x.id !== attachment.id))}
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
