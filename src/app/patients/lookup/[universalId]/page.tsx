import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import { uuidPattern } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function Lookup({
  params,
}: {
  params: Promise<{ universalId: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { universalId } = await params;
  if (!uuidPattern.test(universalId)) notFound();
  const { data, error } = await supabase.rpc("lookup_authorized_child", {
    p_universal_id: universalId,
  });
  if (error) throw new Error("Recherche du dossier indisponible.");
  if (typeof data === "string" && uuidPattern.test(data))
    redirect(`/patients/${data}`);
  return (
    <main className="account-page">
      <DoctorNav />
      <section className="panel">
        <h1 id="main-content" tabIndex={-1}>
          Accès à vérifier
        </h1>
        <p>
          Ce QR contient uniquement un identifiant. Il ne donne aucun accès et
          ne confirme pas l’existence d’un dossier disponible pour votre compte.
        </p>
        <p>
          Identifiant présenté : <code>{universalId}</code>
        </p>
        <Link
          className="button primary"
          href={`/patients/link?identifier=${encodeURIComponent(universalId)}`}
        >
          Demander un accès autorisé
        </Link>
        <p className="fine">
          Une demande sera examinée par un gestionnaire autorisé. Aucune
          information de l’enfant n’est communiquée avant cette décision.
        </p>
      </section>
    </main>
  );
}
