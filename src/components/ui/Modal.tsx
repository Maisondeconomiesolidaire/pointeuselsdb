import { createPortal } from "react-dom";
import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Classes optionnelles pour ajustements ponctuels. La taille de base reste 80vw × 80vh. */
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          // Feuille mobile ancrée en bas, panneau centré à partir de sm.
          "relative z-10 flex w-full flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-strong)]",
          "max-h-[100dvh] min-h-0 rounded-t-3xl border-b-0",
          "sm:max-h-[80vh] sm:h-[80vh] sm:w-[80vw] sm:max-w-[80vw] sm:rounded-2xl sm:border",
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:py-4">
          <h2 className="min-w-0 text-base font-semibold text-[var(--foreground)] sm:truncate sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
