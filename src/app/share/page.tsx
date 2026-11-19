import { PublicHeader } from "@/components/public-header";
import { ShareEntry } from "@/components/sharing/share-entry";
export const dynamic = "force-dynamic";
export default function SharePage() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="account-page share-entry">
        <section className="panel">
          <span className="eyebrow">PARTAGE TEMPORAIRE · SOIGNANT VÉRIFIÉ</span>
          <h1 id="main-content" tabIndex={-1}>
            Ouvrir un carnet partagé
          </h1>
          <p>
            Le responsable de l’enfant choisit les informations et le motif du
            partage. Votre compte doit être vérifié. L’accès est en lecture
            seule et expire à l’échéance du code, au plus tard cinq minutes
            après sa création.
          </p>
          <p>
            Si un médecin vous a invité à assurer le suivi, ouvrez son QR avec
            votre compte médecin vérifié. Vous pourrez ajouter des soins selon
            vos habilitations.
          </p>
          <ShareEntry />
        </section>
      </main>
    </div>
  );
}
