import "@/components/registry/registration.css";
import { ClipboardList, FileText, Zap } from "lucide-react";
import { todayCasablanca } from "@/lib/appointments/calendar";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import {
  QuickRegistrationForm,
  RegistrationForm,
} from "@/components/registry/forms";
import { notFound } from "next/navigation";
import {
  uuidPattern,
  type Facility,
  type ParentChildIntake,
} from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function NewPatient({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; draft?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { source, draft } = await searchParams;
  const paper = source === "paper";
  const quick = !draft && !paper && source !== "full";
  if (draft && !uuidPattern.test(draft)) notFound();
  const [facilitiesResult, draftResult] = await Promise.all([
    quick ? null : supabase.rpc("my_facilities"),
    draft
      ? supabase.rpc("get_parent_child_intake", { p_draft_id: draft })
      : null,
  ]);
  const { data, error } = facilitiesResult ?? {};
  if (error) throw new Error("Impossible de charger les lieux d’exercice.");
  if (draftResult?.error?.code === "42501") notFound();
  if (draftResult?.error)
    throw new Error("Impossible de charger la fiche du parent.");
  const intake = draftResult?.data as ParentChildIntake | null | undefined;
  if (draft && !intake)
    return (
      <ClinicalWorkspace active="children">
        <section className="panel">
          <h1 id="main-content">Fiche parent indisponible</h1>
          <p>
            Demandez au parent d’afficher un nouveau QR pour reprendre la
            saisie.
          </p>
          <Link className="button primary" href="/share">
            Ouvrir le scanner
          </Link>
        </section>
      </ClinicalWorkspace>
    );
  const facilities = (data ?? []) as Facility[];
  const modes = [
    ...(!draft
      ? [
          {
            value: "quick",
            title: "Inscription rapide",
            detail: "Ouvrir le carnet en quatre champs",
            Icon: Zap,
          },
        ]
      : []),
    {
      value: "full",
      title: "Inscription complète",
      detail: "Renseigner le registre et les coordonnées",
      Icon: ClipboardList,
    },
    {
      value: "paper",
      title: "Dossier papier",
      detail: "Transcrire un carnet existant",
      Icon: FileText,
    },
  ];
  return (
    <ClinicalWorkspace active="children">
      <div className="registration-page">
        <div className="page-heading registration-heading">
          <h1 id="main-content" tabIndex={-1}>
            {draft
              ? "Compléter la fiche du parent"
              : paper
                ? "Transcrire un dossier papier"
                : "Inscrire un enfant"}
          </h1>
          <p className="muted">
            Choisissez un mode selon les informations dont vous disposez.
          </p>
          {draft && (
            <p className="notice">
              Vérifiez les informations indiquées par le parent et complétez
              l’inscription. Vous pourrez ensuite vérifier sa demande d’accès au
              carnet.
            </p>
          )}
        </div>
        <nav className="registration-modes" aria-label="Mode d’inscription">
          {modes.map(({ value, title, detail, Icon }) => {
            const query = new URLSearchParams();
            if (value !== "quick") query.set("source", value);
            if (draft) query.set("draft", draft);
            const current =
              value === (quick ? "quick" : paper ? "paper" : "full");
            return (
              <Link
                key={value}
                href={query.size ? `/patients/new?${query}` : "/patients/new"}
                aria-current={current ? "page" : undefined}
              >
                <Icon size={22} aria-hidden="true" />
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </Link>
            );
          })}
        </nav>
        <section
          className="registration-panel"
          aria-labelledby="registration-form-title"
        >
          <h2 id="registration-form-title">
            {quick
              ? "Identité de l’enfant"
              : paper
                ? "Transcription du carnet"
                : "Informations du dossier"}
          </h2>
          {quick ? (
            <QuickRegistrationForm
              key="quick"
              operationId={randomUUID()}
              today={todayCasablanca()}
            />
          ) : facilities.length ? (
            <RegistrationForm
              key={`${paper ? "paper" : "new"}:${draft ?? ""}`}
              operationId={draft ?? randomUUID()}
              facilities={facilities}
              paper={paper}
              intake={intake ?? undefined}
            />
          ) : (
            <p>
              Déclarez d’abord un{" "}
              <Link className="text-link" href="/practices">
                lieu d’exercice
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </ClinicalWorkspace>
  );
}
