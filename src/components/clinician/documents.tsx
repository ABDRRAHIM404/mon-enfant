import Link from "next/link";
import Image from "next/image";
import { documentsIllustration } from "@/components/dashboard/art";
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
        <Image
          className="dashboard-document-art"
          src={documentsIllustration}
          placeholder={documentsIllustration.blurDataURL ? "blur" : "empty"}
          priority
          width={360}
          height={260}
          alt=""
          sizes="(max-width: 700px) 220px, 320px"
        />
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
