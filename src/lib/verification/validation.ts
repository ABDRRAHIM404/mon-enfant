export const EVIDENCE_BUCKET = "professional-evidence";
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;
export const EVIDENCE_SIZE_ERROR =
  "Joignez un PDF, JPEG ou PNG de 4 Mio maximum (4 194 304 octets).";
export function validateEvidenceSize(size: number): string | null {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_EVIDENCE_BYTES
    ? null
    : EVIDENCE_SIZE_ERROR;
}
export const requestStatusLabels: Record<string, string> = {
  under_review: "En cours d’examen",
  approved: "Approuvée",
  rejected: "Rejetée",
  needs_more_evidence: "Complément demandé",
};
export function normalizeRegistration(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}
export function validateApplication(
  name: string,
  registration: string,
  facility: string,
): string | null {
  if (name.trim().length < 3 || name.trim().length > 150)
    return "Indiquez votre nom complet (3 à 150 caractères).";
  if (!/^[A-Z0-9/-]{4,64}$/.test(normalizeRegistration(registration)))
    return "Indiquez un matricule valide (4 à 64 lettres, chiffres, tirets ou barres obliques).";
  if (facility.trim().length < 3 || facility.trim().length > 200)
    return "Indiquez votre établissement (3 à 200 caractères).";
  return null;
}
export function evidenceExtension(
  type: string,
  bytes: Uint8Array,
): "pdf" | "jpg" | "png" | null {
  if (
    type === "application/pdf" &&
    new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
  )
    return "pdf";
  if (
    type === "image/jpeg" &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "jpg";
  if (
    type === "image/png" &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  )
    return "png";
  return null;
}
