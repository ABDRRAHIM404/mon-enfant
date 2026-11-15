import Link from "next/link";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicianShell, ClinicianHeading } from "@/components/clinician/shell";
import { patientName, type Patient } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function NewAppointment({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { profile, supabase } = await requireApprovedDoctor(),
    query = await searchParams;
  const q = (query.q || "").slice(0, 100),
    page = Math.min(10000, Math.max(1, Math.floor(Number(query.page) || 1)));
  const [capability, patients] = await Promise.all([
    supabase.rpc("my_clinical_capabilities"),
    supabase.rpc("list_patients", {
      p_query: q,
      p_history: "all",
      p_age: "all",
      p_page: page,
    }),
  ]);
  if (capability.error || patients.error)
    throw new Error("Impossible de préparer la sélection d’un dossier.");
  const allowed = (capability.data as string[]).includes("appointment"),
    data = patients.data as { items: Patient[]; total: number };
  return (
    <ClinicianShell active="appointments" profile={profile}>
      <ClinicianHeading
        title="Nouveau rendez-vous"
        description="Choisissez un enfant de votre registre autorisé, puis le créneau décidé après examen."
      />
      <Link className="text-link" href="/appointments">
        Retour au calendrier
      </Link>
      {allowed ? (
        <section className="panel">
          <h2>Choisir un enfant</h2>
          <form className="registry-filters" action="/appointments/new">
            <label>
              Rechercher dans mes dossiers autorisés
              <input type="search" name="q" maxLength={100} defaultValue={q} />
            </label>
            <button className="button secondary">Rechercher</button>
          </form>
          <div className="soignant-child-list">
            {data.items.map((c) => (
              <Link key={c.id} href={`/patients/${c.id}/appointments/new`}>
                {patientName(c)}
              </Link>
            ))}
          </div>
          {!data.items.length && (
            <p className="empty-state">
              Aucun dossier autorisé ne correspond à ces critères.
            </p>
          )}
          <nav className="pagination" aria-label="Enfants à sélectionner">
            {page > 1 && (
              <Link
                href={`?${new URLSearchParams({ q, page: String(page - 1) })}`}
              >
                Précédents
              </Link>
            )}
            <span>
              Page {page} · {data.total} dossier(s)
            </span>
            {page * 30 < data.total && (
              <Link
                href={`?${new URLSearchParams({ q, page: String(page + 1) })}`}
              >
                Suivants
              </Link>
            )}
          </nav>
        </section>
      ) : (
        <section className="soignant-attention">
          <h2>Habilitation nécessaire</h2>
          <p>
            La planification nécessite une habilitation explicite à la gestion
            des rendez-vous.
          </p>
          <Link href="/account/clinical-permissions">
            Consulter mes habilitations
          </Link>
        </section>
      )}
    </ClinicianShell>
  );
}
