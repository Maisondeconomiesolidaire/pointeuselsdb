import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { format, getDay, parseISO, startOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

const baseField =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-[var(--foreground)] shadow-sm transition " +
  "focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10";

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block text-sm font-medium text-[var(--foreground)]">
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="text-xs text-[var(--muted-foreground)]">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseField, "h-11", className)} {...props} />
  ),
);

Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(baseField, "min-h-[110px] py-2.5", className)} {...props} />
));

Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(baseField, "h-11", className)} {...props} />
  ),
);

Select.displayName = "Select";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function AppSelect({
  value,
  onChange,
  options,
  placeholder = "Sélectionner",
  disabled,
  className,
  menuClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((next) => !next)}
        className={cn(
          baseField,
          "flex h-11 items-center justify-between gap-3 text-left",
          !selected && "text-[var(--muted-foreground)]",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[70] max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-strong)]",
            menuClassName,
          )}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                  active
                    ? "bg-brand-500 text-white"
                    : "text-[var(--foreground)] hover:bg-[var(--accent)]",
                  option.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.description ? (
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-xs",
                        active ? "text-white/75" : "text-[var(--muted-foreground)]",
                      )}
                    >
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {active ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseISO(value) : null;
  const [month, setMonth] = useState(() => startOfMonth(selectedDate ?? new Date()));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const first = startOfMonth(month);
    const offset = (getDay(first) + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className={cn(
          baseField,
          "flex h-11 items-center justify-between gap-3 text-left",
          !value && "text-[var(--muted-foreground)]",
          className,
        )}
      >
        <span>{selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: fr }) : placeholder}</span>
        <Calendar className="h-4 w-4 shrink-0" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-strong)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((current) => subMonths(current, 1))}
              className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {format(month, "MMMM yyyy", { locale: fr })}
            </p>
            <button
              type="button"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-[var(--muted-foreground)]">
            {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
              <span key={`${day}-${index}`} className="py-1">{day}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = day.getMonth() === month.getMonth();
              const active = selectedDate ? isSameDay(day, selectedDate) : false;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(format(day, "yyyy-MM-dd"));
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg text-sm transition",
                    active
                      ? "bg-brand-500 font-semibold text-white"
                      : "text-[var(--foreground)] hover:bg-[var(--accent)]",
                    !inMonth && "text-[var(--muted-foreground)] opacity-45",
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
