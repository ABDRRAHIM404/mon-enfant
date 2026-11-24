import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Fingerprint,
  Layers,
  LockKeyhole,
  Mail,
  Minus,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  canAccessClinicalWorkspace,
  statusLabels,
  type Professional,
} from "@/lib/authorization";
import { DisplayNameForm, ProfessionalIdCopy } from "./controls";

const verificationCopy = {
  approved:
    "Votre identité professionnelle est vérifiée. Chaque activité clinique dépend de ses propres habilitations.",
  under_review: "Vos justificatifs sont en cours d’examen.",
  unverified:
    "Soumettez vos justificatifs pour demander la vérification de votre compte.",
  rejected: "Consultez la décision et les informations de votre demande.",
  suspended: "Votre compte ne dispose actuellement d’aucun accès clinique.",
} as const;

export function ClinicianAccountWorkspace({
  profile,
  name,
  email,
  capabilities,
}: {
  profile: Professional;
  name: string | null;
  email: string | null;
  capabilities: string[] | null;
}) {
  const state = profile.verification_status;
  const verified = canAccessClinicalWorkspace(profile);
  const provisional = ["unverified", "under_review", "approved"].includes(
    state,
  );
  const role = profile.role === "nurse" ? "Infirmier(e)" : "Médecin";
  const statusTone =
    state === "approved"
      ? "active"
      : state === "under_review"
        ? "pending"
        : state === "rejected"
          ? "error"
          : "inactive";
  const StatusIcon = verified
    ? BadgeCheck
    : state === "under_review"
      ? Clock3
      : state === "rejected"
        ? CircleAlert
        : ShieldCheck;
  const rights = [
    {
      label: "Ajouter et suivre des enfants",
      active: verified,
      Icon: UsersRound,
    },
    {
      label: "Enregistrer des vaccinations",
      active: capabilities?.includes("vaccination") ?? null,
      Icon: Syringe,
    },
    {
      label: "Enregistrer des consultations",
      active: capabilities?.includes("consultation") ?? null,
      Icon: Stethoscope,
    },
    {
      label: "Gérer les rendez-vous",
      active: capabilities?.includes("appointment") ?? null,
      Icon: CalendarDays,
    },
  ];

  return (
    <div className="clinician-account">
      <header className="clinician-account-heading">
        <div>
          <p>Espace soignant</p>
          <h1 id="main-content" tabIndex={-1}>
            Mon compte soignant
          </h1>
          <p>Votre profil, votre sécurité et vos autorisations.</p>
        </div>
        <Image
          src="/dashboard-art/clinician-account-hero.webp"
          width={650}
          height={286}
          alt=""
          unoptimized
        />
      </header>
      <div className="clinician-account-grid">
        <section
          className="clinician-account-card clinician-account-identity"
          aria-label="Identité soignante"
        >
          <Image
            src="/dashboard-art/clinician-account-avatar.webp"
            alt=""
            width={256}
            height={256}
            unoptimized
          />
          <div>
            <h2>{name ?? "Compte soignant"}</h2>
            <div className="clinician-identity-tags">
              <span className="clinician-account-badge" data-tone="profession">
                <Stethoscope size={17} aria-hidden="true" /> {role}
              </span>
              <span className="clinician-account-badge" data-tone={statusTone}>
                <StatusIcon size={17} aria-hidden="true" />{" "}
                {statusLabels[state]}
              </span>
            </div>
          </div>
          <Stethoscope
            className="clinician-account-watermark"
            aria-hidden="true"
          />
        </section>
        <section
          className="clinician-account-card clinician-account-verification"
          aria-labelledby="clinical-verification-heading"
        >
          <span className="clinician-verification-icon" data-tone={statusTone}>
            <StatusIcon size={29} aria-hidden="true" />
          </span>
          <div>
            <h2 id="clinical-verification-heading">Statut de vérification</h2>
            <p>{verificationCopy[state]}</p>
            {!verified && state !== "suspended" && (
              <Link className="clinician-account-button" href="/verification">
                {state === "under_review"
                  ? "Suivre ma demande"
                  : "Ouvrir ma demande de vérification"}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
        <section
          className="clinician-account-card clinician-account-information"
          id="soignant-settings"
        >
          <h2>
            <UserRound aria-hidden="true" /> Informations du compte
          </h2>
          <dl className="clinician-account-fields">
            <div>
              <dt>
                <Mail aria-hidden="true" /> Adresse e-mail
              </dt>
              <dd>{email || "Non disponible"}</dd>
            </div>
            <div>
              <dt>
                <BriefcaseBusiness aria-hidden="true" /> Métier déclaré
              </dt>
              <dd>{role}</dd>
            </div>
          </dl>
          <p className="clinician-account-small">
            L’adresse e-mail et le métier sont en lecture seule ici.
          </p>
          {state !== "suspended" && <DisplayNameForm name={name} />}
        </section>
        <section className="clinician-account-card clinician-account-security">
          <h2>
            <ShieldCheck aria-hidden="true" /> Sécurité du compte
          </h2>
          <Link
            className="clinician-account-button clinician-security-link"
            href="/forgot-password?audience=clinician"
          >
            <LockKeyhole size={19} aria-hidden="true" /> Changer mon mot de
            passe <ChevronRight size={17} aria-hidden="true" />
          </Link>
        </section>
        <section className="clinician-account-card clinician-account-platform">
          <div>
            <h2>
              <Fingerprint aria-hidden="true" /> Identifiant professionnel
            </h2>
            <p>
              Identifiant unique de la plateforme, utilisé pour la traçabilité.
            </p>
          </div>
          <ProfessionalIdCopy id={profile.professional_id} />
        </section>
        <section className="clinician-account-card clinician-account-rights">
          <h2>
            <ShieldCheck aria-hidden="true" /> Mes autorisations
          </h2>
          <ul>
            {rights.map(({ label, active, Icon }) => {
              const available = verified ? active : false;
              return (
                <li key={label}>
                  <Icon size={23} aria-hidden="true" />
                  <div>
                    <strong>{label}</strong>
                    <small>
                      {available === null
                        ? "Statut indisponible"
                        : available
                          ? "Autorisé"
                          : "Non accordé"}
                    </small>
                  </div>
                  {available ? (
                    <Check
                      className="clinician-right-active"
                      size={18}
                      aria-hidden="true"
                    />
                  ) : (
                    <Minus
                      className="clinician-right-inactive"
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="clinician-account-clinical">
            <div>
              <h3>
                <Stethoscope aria-hidden="true" /> Mes habilitations cliniques
              </h3>
              <p>
                La vérification professionnelle et les habilitations cliniques
                sont examinées séparément.
              </p>
            </div>
            <div className="clinician-clinical-links">
              {verified && (
                <Link
                  className="clinician-account-button"
                  href="/account/clinical-permissions"
                >
                  Voir mes habilitations{" "}
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              )}
              {provisional && (
                <Link
                  className="clinician-account-button clinician-provisional-link"
                  href="/provisional"
                >
                  <Layers size={18} aria-hidden="true" /> Ouvrir mes dossiers
                  provisoires <ChevronRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
