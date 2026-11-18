import { randomUUID } from "node:crypto";
import { ParentWorkflow } from "@/components/parents/workflow";
import { DashboardHeading } from "@/components/dashboard/heading";
import { GuardianClaimForm } from "@/components/parents/guardian-forms";
export const dynamic = "force-dynamic";
export default function Invitation() {
  return (
    <ParentWorkflow active="invitation">
      <DashboardHeading
        title="Relier le carnet de mon enfant"
        description="Utilisez l’invitation personnelle remise par le professionnel."
        section="children"
      />
      <section className="panel">
        <h2>Votre invitation personnelle</h2>
        <p>
          Votre invitation permet de demander le lien avec un carnet existant.
          Aucun dossier n’est accessible avant la vérification du responsable
          par le professionnel.
        </p>
        <GuardianClaimForm operationId={randomUUID()} />
      </section>
    </ParentWorkflow>
  );
}
