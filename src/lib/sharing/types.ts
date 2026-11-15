import type { ParentBooklet, ParentChild } from "@/lib/parents/types";
import type { ClinicalEntry } from "@/lib/clinical/types";
import type { PatientVaccineItem } from "@/lib/vaccines/patient-types";
export type ShareScope = "vaccination_read" | "booklet_read";
export const shareLabels: Record<ShareScope, string> = {
  vaccination_read: "Vaccinations et références",
  booklet_read: "Carnet pour une consultation",
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
  if (/^[A-Za-z0-9_-]{43}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (
      url.origin !== new URL(origin).origin ||
      url.pathname !== "/share" ||
      url.search
    )
      return null;
    const entries = [...new URLSearchParams(url.hash.slice(1))];
    if (entries.length !== 1 || entries[0][0] !== "share") return null;
    return /^[A-Za-z0-9_-]{43}$/.test(entries[0][1]) ? entries[0][1] : null;
  } catch {
    return null;
  }
}
