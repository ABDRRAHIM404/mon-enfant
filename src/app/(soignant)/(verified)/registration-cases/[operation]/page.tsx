import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { ResumeRegistrationForm } from "@/components/registry/forms";
import { uuidPattern } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
const labels: Record<string, string> = {
  ready:
    "Contrôle terminé — création possible sous réserve du dernier contrôle transactionnel",
  needs_details: "Informations supplémentaires nécessaires",
  need_qr: "Présenter le QR parent pour le parcours d’accès autorisé",
  needs_review: "En attente de revue contrôlée",
};
export default async function RegistrationCase({
  params,
}: {
  params: Promise<{ operation: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { operation } = await params;
  if (!uuidPattern.test(operation)) notFound();
  const { data, error } = await supabase.rpc("my_registration_cases", {
    p_operation_id: operation,
  });
  if (error) throw new Error("Impossible de charger cette inscription.");
  const item = data.items?.[0] as
    | {
        operation_id: string;
        state: string;
        secondary_locked: boolean;
        mother_name: string | null;
        birthplace: string | null;
        payload: {
          given_name: string;
          family_name: string;
          birth_date: string;
        };
        expires_at: string;
      }
    | undefined;
  if (!item) notFound();
  return (
    <ClinicalWorkspace active="tools">
      <section className="panel">
        <h1 id="main-content" tabIndex={-1}>
          Reprendre mon inscription
        </h1>
        <p>
          Ces informations sont celles que vous avez proposées ; aucun dossier
          existant n’est affiché.
        </p>
        <p>
          {item.payload.given_name} {item.payload.family_name} ·{" "}
          {item.payload.birth_date || "Naissance inconnue"}
        </p>
        <p className="notice">{labels[item.state]}</p>
        <p className="fine">
          Contrôle valable jusqu’au{" "}
          {new Date(item.expires_at).toLocaleString("fr-MA", {
            timeZone: "Africa/Casablanca",
          })}
          .
        </p>
        <ResumeRegistrationForm
          operationId={operation}
          mother={item.mother_name}
          birthplace={item.birthplace}
          locked={item.secondary_locked}
        />
      </section>
      <Link href="/registration-reviews">Retour aux revues</Link>
    </ClinicalWorkspace>
  );
}
