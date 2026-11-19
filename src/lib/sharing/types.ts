import type { ParentBooklet, ParentChild } from "@/lib/parents/types";
import type { ClinicalEntry } from "@/lib/clinical/types";
import type { PatientVaccineItem } from "@/lib/vaccines/patient-types";
export type ShareScope = "vaccination_read" | "booklet_read" | "care_visit";
export const shareLabels: Record<ShareScope, string> = {
  vaccination_read: "Vaccinations et références",
  booklet_read: "Carnet de santé",
  care_visit: "Accès au dossier et ajout de soins",
};
export type ShareItem = {
  id: string;
  scope: ShareScope;
  expires_at: string;
  professional_id: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  active: boolean;
};
export type ShareList = {
  items: ShareItem[];
  can_share: boolean;
  server_now: string;
};
export type ShareReceipt = {
  accepted: boolean;
  id: string;
  scope: ShareScope;
  expires_at: string;
  server_now: string;
  token?: string;
  child_id?: string;
};
export type VaccinationShareData = {
  references: {
    child: ParentChild;
    items: PatientVaccineItem[];
    total: number;
  };
  history: { items: ClinicalEntry[]; total: number };
};
export type SharedView = ShareReceipt & {
  professional_id: string;
  data: VaccinationShareData | Omit<ParentBooklet, "link">;
};
export function shareToken(value: string, origin: string): string | null {
  const text = value.trim();
  if (/^(?:draft:)?[A-Za-z0-9_-]{43}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (
      url.origin !== new URL(origin).origin ||
      url.pathname !== "/share" ||
      url.search
    )
      return null;
    const entries = [...new URLSearchParams(url.hash.slice(1))];
    if (entries.length !== 1) return null;
    const [purpose, token] = entries[0];
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    if (purpose === "draft") return `draft:${token}`;
    return purpose === "share" ? token : null;
  } catch {
    return null;
  }
}
