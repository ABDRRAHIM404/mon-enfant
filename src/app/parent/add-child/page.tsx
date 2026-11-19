import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { birthLabel } from "@/lib/registry/types";
import { DashboardHeading } from "@/components/dashboard/heading";
import { ParentWorkflow } from "@/components/parents/workflow";
import {
  AddChildDraftForm,
  ChildDraftQr,
} from "@/components/parents/child-draft-forms";

export const dynamic = "force-dynamic";
type Draft = {
  id: string;
  given_name: string;
  family_name: string;
  birth_date: string;
  status: "draft" | "with_doctor" | "awaiting_review" | "linked" | "closed";
  child_id: string | null;
};
const statuses: Record<Draft["status"], string> = {
  draft: "À présenter au médecin",
  with_doctor: "Fiche ouverte par le médecin",
  awaiting_review: "Carnet créé · accès parent à vérifier",
  linked: "Carnet accessible",
  closed: "Carnet indisponible · contactez votre médecin",
};

export default async function ParentAddChild({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const { supabase } = await requireUser();
  const [{ data, error }, { added }] = await Promise.all([
    supabase.rpc("list_parent_child_drafts"),
    searchParams,
  ]);
  if (error?.code === "42501") redirect("/login?audience=parent");
  if (error) throw new Error("Impossible de charger les fiches.");
  const items = (data as { items: Draft[] }).items;
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Casablanca",
  }).format(new Date());
  return (
    <ParentWorkflow active="children">
      <DashboardHeading
        title="Ajouter un enfant"
        description="Saisissez son nom et sa date de naissance. Montrez ensuite la fiche au médecin pour qu’il complète le carnet."
        section="children"
      />
      <section className="panel">
        <h2>Nouvelle fiche</h2>
        <AddChildDraftForm
          key={added ?? "new"}
          operationId={randomUUID()}
          today={today}
        />
      </section>
      {items.length > 0 && (
        <section className="panel">
          <h2>Mes fiches</h2>
          <div className="record-list">
            {items.map((item) => (
              <article key={item.id} id={`fiche-${item.id}`}>
                <h3>
                  {item.given_name} {item.family_name}
                </h3>
                <p>
                  {birthLabel({
                    birth_date: item.birth_date,
                    birth_date_precision: "exact",
                  })}{" "}
                  · {statuses[item.status]}
                </p>
                {added === item.id && (
                  <p className="notice" role="status">
                    Fiche enregistrée.
                  </p>
                )}
                {item.child_id && (
                  <Link
                    className="button primary"
                    href={`/parent/children/${item.child_id}`}
                  >
                    Ouvrir le carnet
                  </Link>
                )}
                {(item.status === "draft" || item.status === "with_doctor") && (
                  <>
                    <p className="fine">
                      En affichant le QR, vous autorisez le médecin à consulter
                      ces informations et à traiter votre demande d’accès au
                      carnet. Un nouveau code remplace le précédent.
                    </p>
                    <ChildDraftQr draftId={item.id} />
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      <Link className="text-link" href="/parent/invitation">
        Relier un carnet déjà créé
      </Link>
    </ParentWorkflow>
  );
}
