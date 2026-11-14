import Link from "next/link";
import { HeartPulse } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon" aria-hidden="true">
        <HeartPulse size={24} />
      </span>
      <span>
        mon enfant
        <span className="brand-sub">LE CARNET QUI GRANDIT AVEC LUI</span>
        <span className="sr-only"> — Accueil</span>
      </span>
    </Link>
  );
}
