import Link from "next/link";
import { FileClock } from "lucide-react";
import { redirect } from "next/navigation";
import { getProfessional, requireApprovedDoctor } from "@/lib/auth";
import { ClinicianShell, ClinicianHeading } from "./shell";
export async function ClinicianDocuments({
  provisional = false,
}: {
  provisional?: boolean;
}) {
  const { profile } = provisional
    ? await getProfessional()
    : await requireApprovedDoctor();
  if (
    !profile ||
    !["doctor", "nurse"].includes(profile.role) ||
    profile.verification_status === "suspended"
  )
    redirect("/account");
  return (
    <ClinicianShell
      active="documents"
      provisional={provisional}
      profile={profile}
    >
      <ClinicianHeading
        title="Documents"
        description="Gestion des documents de votre espace soignant."
      />
      <section className="panel soignant-coming-soon">
        <FileClock size={64} aria-hidden="true" />
        <h2>Bientôt disponible</h2>
        <p>
          La gestion centralisée des documents n’est pas encore disponible.
          Aucun dépôt ni téléchargement de document n’est proposé ici.
        </p>
        <p className="soignant-attention">
          {provisional
            ? "Les dossiers provisoires restent privés à leur auteur. Aucun export ni partage de ces dossiers n’est disponible."
            : "Les résumés et exports déjà autorisés restent accessibles depuis chaque dossier enfant."}
        </p>
        <Link
          className="button secondary"
          href={provisional ? "/provisional/children" : "/patients"}
        >
          {provisional ? "Mes dossiers privés" : "Ouvrir mon registre"}
        </Link>
      </section>
    </ClinicianShell>
  );
}
