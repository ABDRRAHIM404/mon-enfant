import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Brand } from "@/components/brand";
import { GuardianClaimForm } from "@/components/parents/guardian-forms";
export const dynamic = "force-dynamic";
export default function Invitation() {
  return (
    <main className="account-page">
      <header>
        <Brand />
        <Link href="/parent">Espace parent</Link>
      </header>
      <section className="panel">
        <h1 id="main-content" tabIndex={-1}>
          Votre invitation personnelle
        </h1>
        <p>
          Votre invitation permet de demander le lien avec un carnet existant.
          Aucun dossier n’est accessible avant la vérification du responsable
          par le professionnel.
        </p>
        <GuardianClaimForm operationId={randomUUID()} />
      </section>
    </main>
  );
}
