import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import { RegistrationReviewForm } from "@/components/registry/forms";
export const dynamic = "force-dynamic";
type Review = {
  actor_id: string;
  operation_id: string;
  revision: number;
  submitted: {
    given_name: string;
    family_name: string;
    birth_date: string;
    sex: string;
    mother_name: string | null;
    birthplace: string | null;
  };
  authorized_candidates: string[];
  expires_at: string;
};
export default async function RegistrationReviews({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const page = Number((await searchParams).page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) notFound();
  const own = await supabase.rpc("my_registration_cases");
  if (own.error) throw new Error("Impossible de charger vos inscriptions.");
  const pending = own.data.items as {
    operation_id: string;
    state: string;
    payload: { given_name: string; family_name: string };
  }[];
  const { data, error } = await supabase.rpc("registration_review_queue", {
    p_page: page,
  });
  if (error) throw new Error("Impossible de charger les revues d’inscription.");
  const result = data as { items: Review[]; total: number };
  return (
    <main className="account-page wide">
      <DoctorNav />
      <section className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Revues contrôlées d’inscription
        </h1>
        <p>
          Seules les demandes pour lesquelles vous gérez déjà tous les dossiers
          concernés sont affichées. La revue est indépendante du demandeur et ne
          fusionne aucun dossier, ni ne lui accorde d’accès.
        </p>
      </section>
      <section className="panel">
        <h2>Mes inscriptions à reprendre</h2>
        {pending.length ? (
          <ul>
            {pending.map((item) => (
              <li key={item.operation_id}>
                <Link href={`/registration-cases/${item.operation_id}`}>
                  {item.payload.given_name} {item.payload.family_name} —
                  reprendre le contrôle
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucune inscription en attente.</p>
        )}
      </section>
      {result.items.map((item) => (
        <article
          key={`${item.actor_id}:${item.operation_id}`}
          className="panel"
        >
          <h2>Identité proposée pour une nouvelle inscription</h2>
          <dl className="details">
            <dt>Nom déclaré</dt>
            <dd>
              {item.submitted.given_name} {item.submitted.family_name}
            </dd>
            <dt>Naissance déclarée</dt>
            <dd>{item.submitted.birth_date}</dd>
            <dt>Mère déclarée</dt>
            <dd>{item.submitted.mother_name || "Non renseigné"}</dd>
            <dt>Lieu de naissance déclaré</dt>
            <dd>{item.submitted.birthplace || "Non renseigné"}</dd>
          </dl>
          <p className="fine">
            Vérifiez uniquement vos dossiers déjà autorisés et une source
            appropriée ; ne concluez pas à une identité commune sur les seuls
            noms.
          </p>
          <ul>
            {item.authorized_candidates.map((id) => (
              <li key={id}>
                <Link href={`/patients/${id}`}>
                  Ouvrir un dossier dont vous gérez l’accès
                </Link>
              </li>
            ))}
          </ul>
          <RegistrationReviewForm
            actorId={item.actor_id}
            operationId={item.operation_id}
            revision={item.revision}
          />
        </article>
      ))}
      {!result.items.length && (
        <p>Aucune revue disponible dans votre périmètre actuel.</p>
      )}
      <nav className="pagination" aria-label="Pages des revues">
        {page > 1 && <Link href={`?page=${page - 1}`}>Page précédente</Link>}
        {page * 30 < result.total && (
          <Link href={`?page=${page + 1}`}>Page suivante</Link>
        )}
      </nav>
    </main>
  );
}
