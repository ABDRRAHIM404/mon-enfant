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
            Scannez le QR présenté par le parent. Le code est à usage unique et
            expire cinq minutes après sa création.
          </p>
          <p>
            Si le parent vous autorise à documenter la visite, ouvrez le code
            avec votre compte médecin vérifié. Vous pourrez consulter le dossier
            et ajouter des soins selon vos habilitations.
          </p>
          <p>
            Pour une nouvelle fiche parent, le QR préremplit le nom et la date
            de naissance dans le formulaire d’inscription.
          </p>
          <ShareEntry />
        </section>
      </main>
    </div>
  );
}
