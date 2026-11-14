import QRCode from "qrcode";
import { uuidPattern } from "@/lib/registry/types";
export function clinicianLookupUrl(origin: string, universalId: string) {
  if (!uuidPattern.test(universalId))
    throw new Error("Identifiant de dossier invalide.");
  const base = new URL(origin);
  if (!["https:", "http:"].includes(base.protocol))
    throw new Error("Origine du carnet invalide.");
  return `${base.origin}/patients/lookup/${universalId}`;
}
export function qrSymbol(value: string) {
  if (!value || value.length > 512) throw new Error("QR indisponible.");
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  let path = "";
  for (let row = 0; row < modules.size; row++) {
    let col = 0;
    while (col < modules.size) {
      if (!modules.data[row * modules.size + col]) {
        col++;
        continue;
      }
      const start = col;
      while (col < modules.size && modules.data[row * modules.size + col])
        col++;
      path += `M${start + 4} ${row + 4}h${col - start}v1H${start + 4}z`;
    }
  }
  return { size: modules.size + 8, path };
}
