export const EMPLOYEE_STATUSES = [
  "MAD",
  "Compagnon permanent",
  "Compagnon insertion",
  "Renfort ponctuel",
  "Encadrant",
] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const PROJECT_STATUSES = [
  { value: "en_cours", label: "En cours", tone: "green" as const },
  { value: "en_pause", label: "En pause", tone: "amber" as const },
  { value: "termine", label: "Terminé", tone: "neutral" as const },
];

export function projectStatusMeta(value: string) {
  return (
    PROJECT_STATUSES.find((s) => s.value === value) ?? {
      value,
      label: value,
      tone: "neutral" as const,
    }
  );
}

export const INVOICE_STATUSES = [
  { value: "brouillon", label: "Brouillon", tone: "neutral" as const },
  { value: "envoyee", label: "Envoyée", tone: "blue" as const },
  { value: "payee", label: "Payée", tone: "green" as const },
  { value: "en_retard", label: "En retard", tone: "red" as const },
];

export function invoiceStatusMeta(value: string) {
  return (
    INVOICE_STATUSES.find((s) => s.value === value) ?? {
      value,
      label: value,
      tone: "neutral" as const,
    }
  );
}

export const CLIENT_TYPES = [
  { value: "interne", label: "Interne", tone: "blue" as const },
  { value: "externe", label: "Externe", tone: "neutral" as const },
];

export function clientTypeMeta(value?: string) {
  return (
    CLIENT_TYPES.find((item) => item.value === value) ?? {
      value: "externe",
      label: "Externe",
      tone: "neutral" as const,
    }
  );
}
