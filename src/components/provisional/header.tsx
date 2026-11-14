import Link from "next/link";
import { Brand } from "@/components/brand";
import { statusLabels, type Professional } from "@/lib/authorization";
export function ProvisionalHeader({ profile }: { profile: Professional }) {
  return (
    <>
      <header className="workspace-header">
        <Brand />
        <nav aria-label="Espace soignant">
          <Link href="/provisional">Mes dossiers provisoires</Link>
          <Link href="/account">Mon compte soignant</Link>
          <Link href="/verification">Vérification</Link>
          {profile.verification_status === "approved" && (
            <Link href="/dashboard">Dossiers autorisés</Link>
          )}
        </nav>
      </header>
      <section className="panel">
        <span className="eyebrow">MÉDECINS ET INFIRMIER(E)S</span>
        <p className="status">
          Compte : {statusLabels[profile.verification_status]} ·{" "}
          {profile.role === "nurse" ? "Infirmier(e)" : "Médecin"}
        </p>
        <p>
          <strong>Dossiers : Non vérifiés / provisoires.</strong> Privés à leur
          auteur. La vérification du compte ne les valide ni ne les publie.
        </p>
        <p className="fine">
          Environnement de développement · Données fictives uniquement.
        </p>
      </section>
    </>
  );
}
