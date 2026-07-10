import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUpload } from "../../lib/useUpload";

export type PickedPhoto = { id: Id<"ptDocuments">; name: string };

export function PhotoPicker({
  projectId,
  photos,
  onChange,
}: {
  projectId: Id<"ptProjects"> | null;
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
}) {
  const upload = useUpload();
  const registerDocument = useMutation(api.pointeuse.registerDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || !projectId) return;
    setBusy(true);
    try {
      const added: PickedPhoto[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const storageId = await upload(file);
        const id = await registerDocument({
          storageId,
          name: file.name || "Photo",
          mimeType: file.type || "image/webp",
          kind: "chantier_photo",
          projectId,
        });
        added.push({ id, name: file.name || "Photo" });
      }
      onChange([...photos, ...added]);
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
        accept="image/*"
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
          <ImagePlus className="h-4 w-4" />
        )}
        {projectId ? "Ajouter des photos" : "Sélectionnez d'abord un projet"}
      </button>

      {photos.length > 0 ? (
        <ul className="space-y-1.5">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ImagePlus className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                <span className="truncate text-[var(--foreground)]">{photo.name}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(photos.filter((x) => x.id !== photo.id))}
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
