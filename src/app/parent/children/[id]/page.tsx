import { DashboardHeading } from "@/components/dashboard/heading";
import { ParentWorkflow } from "@/components/parents/workflow";
import Link from "next/link";
import { QrCode } from "@/components/qr/code";
import { clinicianLookupUrl } from "@/lib/qr/symbol";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { EntryCard } from "@/components/clinical/entry-card";
import { GrowthChart } from "@/components/clinical/growth-chart";
import { PrintButton } from "@/components/clinical/print-button";
import { GuardianRevokeForm } from "@/components/parents/guardian-forms";
import {
  patientName,
  birthLabel,
  historyLabels,
  uuidPattern,
} from "@/lib/registry/types";
import { appointmentTime } from "@/lib/appointments/calendar";
import { appointmentStates } from "@/lib/appointments/types";
import type { ParentBooklet } from "@/lib/parents/types";
export const dynamic = "force-dynamic";
export default async function ChildBooklet({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const page = Number(query.page ?? 1);
  if (
    !uuidPattern.test(id) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000
  )
    notFound();
  const { data, error } = await supabase.rpc("parent_child_booklet", {
    p_child_id: id,
    p_page: page,
  });
  if (error?.code === "42501" || (!data && !error)) notFound();
  if (error) throw new Error("Impossible de charger ce carnet.");
  const booklet = data as ParentBooklet;
  const { child, link, entries, growth, appointments } = booklet;
  const pages = Math.max(
    1,
    Math.ceil(Math.max(booklet.entry_total, booklet.appointment_total) / 30),
  );
  return (
    <ParentWorkflow
      active="children"
      childId={id}
      childSection="booklet"
      child={child}
    >
      <DashboardHeading
        title={patientName(child)}
        description={`${birthLabel(child)} · ${historyLabels[child.history_status]}`}
        section="children"
      />

      <p className="notice">
        Ce carnet présente les informations enregistrées par les professionnels.
        Une information absente ne signifie pas un soin manqué ni un état de
        santé normal. Contactez le professionnel pour une question ou une
        correction.
      </p>
      <nav
        className="care-page-actions no-print"
        aria-label="Dans cette page du carnet"
      >
        <a className="button secondary" href="#visits">
          Soins enregistrés
        </a>
        <a className="button secondary" href="#growth">
          Mesures
        </a>
        <a className="button secondary" href="#appointments">
          Rendez-vous enregistrés
        </a>
        <a className="button secondary" href="#access">
          Mon accès actuel
        </a>
      </nav>

      <div id="documents" className="actions no-print">
        <PrintButton />
        {link.can_export && (
          <a
            className="button secondary"
            href={`/parent/children/${id}/export`}
          >
            Télécharger l’historique complet (JSON)
          </a>
        )}
      </div>
      <p className="fine">
        L’impression comprend cette page et les 60 dernières mesures actives. Le
        téléchargement autorisé conserve les révisions et retraits.
      </p>
      <section id="visits">
        <h2>Soins et vaccinations documentés</h2>
        <p className="fine">
          {booklet.entry_total} entrées actives · page {page} sur {pages}. Les
          soins restent attribués à leurs professionnels et sources.
        </p>
        {entries.length ? (
          <ol
            className="booklet-timeline booklet-clinical-timeline"
            role="list"
          >
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryCard entry={entry} link={false} />
                <p className="no-print">
                  <Link
                    href={`/parent/children/${id}/requests?entry=${entry.id}`}
                  >
                    Demander une correction pour ce soin
                  </Link>
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p>Aucun soin documenté sur cette page.</p>
        )}
      </section>
      <section id="growth">
        <h2>Croissance</h2>
        <p className="fine">
          60 dernières mesures actives. Les points correspondent aux dates
          exactes ; consultez les entrées pour les mesures à date incertaine.
        </p>
        <div className="two-columns">
          <GrowthChart
            entries={growth}
            field="weight_kg"
            label="Poids"
            unit="kg"
          />
          <GrowthChart
            entries={growth}
            field="height_cm"
            label="Taille"
            unit="cm"
          />
          <GrowthChart
            entries={growth}
            field="head_cm"
            label="Périmètre crânien"
            unit="cm"
          />
        </div>
      </section>
      <section id="appointments" className="panel">
        <h2>Rendez-vous</h2>
        <p className="fine">
          {booklet.appointment_total} rendez-vous · page {page} sur {pages}.
          Horaires de Casablanca.
        </p>
        <div className="record-list">
          {appointments.map((appointment) => (
            <article key={appointment.id}>
              <h3>{appointment.purpose_label}</h3>
              <p>
                {appointmentTime(appointment.starts_at)} —{" "}
                {appointmentTime(appointment.ends_at)}
              </p>
              <p>{appointmentStates[appointment.effective_state]}</p>
              <p>
                {appointment.facility_name} · Professionnel{" "}
                {appointment.professional_id}
              </p>
              {appointment.dose_code && (
                <p>
                  Référence vaccinale : {appointment.dose_code} ·{" "}
                  {appointment.version_label}
                </p>
              )}
              {appointment.was_missed && (
                <p className="fine">
                  Un ancien rendez-vous manqué reste conservé dans l’historique.
                </p>
              )}
              {appointment.recorded_by_other && (
                <p className="fine">
                  La dose associée a été documentée par un autre professionnel
                  autorisé.
                </p>
              )}
            </article>
          ))}
        </div>
        {!appointments.length && (
          <p>Aucun rendez-vous enregistré sur cette page.</p>
        )}
        <p className="fine">
          Pour déplacer ou confirmer un rendez-vous, contactez le professionnel.
          Un rendez-vous passé ne prouve pas à lui seul une vaccination manquée.
        </p>
      </section>
      <nav className="actions no-print" aria-label="Pages du carnet">
        {page > 1 && (
          <Link className="button secondary" href={`?page=${page - 1}`}>
            Page précédente
          </Link>
        )}
        {page < pages && (
          <Link className="button secondary" href={`?page=${page + 1}`}>
            Page suivante
          </Link>
        )}
      </nav>
      <section className="panel">
        <h2>Présenter le carnet à un professionnel</h2>
        <p>
          Le professionnel doit se connecter avant de scanner. Ce QR ne contient
          que l’identifiant du dossier et ne donne aucun accès aux soins.
        </p>
        <QrCode
          value={clinicianLookupUrl(
            process.env.NEXT_PUBLIC_SITE_URL ?? "https://mon-enfant.vercel.app",
            child.universal_id,
          )}
          label="Identification du dossier — accès professionnel vérifié à l’ouverture"
        />
      </section>
      <section id="access" className="panel no-print">
        <h2>Mon accès à ce carnet</h2>
        <p>
          Autorisé jusqu’au{" "}
          {new Date(link.expires_at).toLocaleDateString("fr-MA", {
            timeZone: "Africa/Casablanca",
          })}
          .
        </p>
        <p>
          Vous pouvez retirer votre propre accès. Cette action ne modifie pas
          les soins enregistrés ni les accès des autres responsables.
        </p>
        <GuardianRevokeForm
          id={link.id}
          childId={id}
          kind="link"
          returnToParent
        />
      </section>
      <p className="fine">
        Environnement de développement · Données fictives uniquement
      </p>
    </ParentWorkflow>
  );
}
