import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Link2,
  Mail,
  LockKeyhole,
  MapPin,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UserRoundPlus,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import "./homepage.css";

export const metadata: Metadata = {
  title: "Mon Enfant · Le carnet de santé de votre enfant",
  description:
    "Découvrez Mon Enfant, un carnet de santé numérique pour le suivi des vaccinations, de la croissance et des rendez-vous. Un projet de deux cofondateurs originaires de Belfaa.",
};

const steps = [
  {
    Icon: UserRoundPlus,
    title: "Créez votre espace parent",
    description:
      "Inscrivez-vous et confirmez votre adresse e-mail pour accéder à votre espace.",
  },
  {
    Icon: Link2,
    title: "Reliez le carnet de votre enfant",
    description:
      "Utilisez l’invitation remise par un soignant autorisé. Le carnet s’ouvre après vérification de votre qualité de responsable.",
  },
  {
    Icon: BookOpen,
    title: "Retrouvez son suivi au fil des visites",
    description:
      "Consultez les informations enregistrées par les soignants autorisés et retrouvez les prochains rendez-vous.",
  },
];

const sampleEntries = [
  {
    Icon: Syringe,
    title: "Vaccination",
    detail: "Dose documentée par le soignant",
    date: "12 nov.",
    tone: "jade",
  },
  {
    Icon: ChartNoAxesCombined,
    title: "Mesures de croissance",
    detail: "8,4 kg · 71 cm",
    date: "12 nov.",
    tone: "seafoam",
  },
  {
    Icon: CalendarDays,
    title: "Consultation de suivi",
    detail: "Rendez-vous enregistré",
    date: "10 déc.",
    tone: "apricot",
  },
];

function BookletPreview() {
  return (
    <figure className="homepage-hero-visual">
      <div className="preview-mat">
        <div className="preview-book">
          <div className="preview-book-header">
            <span>
              <BookOpen aria-hidden="true" /> Mon Enfant
            </span>
            <span className="preview-sample">Données fictives</span>
          </div>
          <div className="preview-child">
            <span className="preview-avatar" aria-hidden="true">
              N
            </span>
            <div>
              <h2>Carnet de Nour</h2>
              <p>Vaccinations · Croissance · Rendez-vous</p>
            </div>
          </div>
          <ul
            className="preview-entries"
            aria-label="Exemples d’entrées du carnet"
          >
            {sampleEntries.map(({ Icon, title, detail, date, tone }) => (
              <li key={title}>
                <span className="preview-entry-icon" data-tone={tone}>
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{detail}</p>
                </div>
                <span className="preview-date">{date}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption>Aperçu du carnet numérique</figcaption>
    </figure>
  );
}

const founders = [
  {
    name: "Abdorrahim Bounga",
    role: "Cofondateur · Développeur",
    bio: "Abdorrahim conçoit et développe Mon Enfant. Il traduit les besoins des familles et des soignants en parcours simples, de la création du compte à la consultation du carnet.",
    whatsapp: "https://wa.me/212657143579",
    phone: "06 57 14 35 79",
  },
  {
    name: "Aimran",
    role: "Cofondateur · Infirmier",
    bio: "Aimran apporte le regard du soin au projet. Son expérience d’infirmier guide la manière de présenter les informations utiles aux familles et de faire une place au suivi entre deux visites.",
    whatsapp: "https://wa.me/212659181349",
    phone: "06 59 18 13 49",
  },
];

const contactEmail = "abdorrahimbounga1@gmail.com";

export default function Home() {
  return (
    <div className="public-site homepage">
      <PublicHeader />
      <main>
        <section
          className="homepage-shell homepage-hero"
          aria-labelledby="main-content"
        >
          <div className="homepage-hero-copy">
            <p className="homepage-kicker">Carnet de santé numérique · Maroc</p>
            <h1 id="main-content" tabIndex={-1}>
              Toute son histoire de santé. <em>Au même endroit.</em>
            </h1>
            <p className="homepage-intro">
              Retrouvez ses vaccinations, ses mesures de croissance et ses
              rendez-vous au même endroit, du premier suivi aux prochaines
              visites.
            </p>
            <div className="homepage-actions">
              <Link href="/login" className="button primary">
                Espace parent <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <p className="homepage-care-link">
              <Link href="/login?audience=clinician">
                Médecins et infirmier(e)s <ArrowUpRight aria-hidden="true" />
              </Link>
            </p>
          </div>
          <BookletPreview />
        </section>

        <section
          className="homepage-section homepage-journey"
          id="fonctionnalites"
          aria-labelledby="journey-title"
        >
          <div className="homepage-shell">
            <header className="homepage-section-heading">
              <p className="homepage-kicker">Le parcours parent</p>
              <h2 id="journey-title">Du compte au carnet, en trois étapes</h2>
              <p>
                Une fois le carnet relié, gardez les informations de suivi à
                portée de main entre les visites.
              </p>
            </header>
            <ol className="homepage-steps" role="list">
              {steps.map(({ Icon, title, description }, index) => (
                <li className="homepage-step" key={title}>
                  <div className="homepage-step-marker" aria-hidden="true">
                    <Icon />
                    <span>0{index + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="homepage-shell homepage-section homepage-benefits"
          aria-labelledby="benefits-title"
        >
          <header className="homepage-section-heading">
            <h2 id="benefits-title">Un carnet qui relie les visites</h2>
          </header>
          <div className="homepage-audiences">
            <article>
              <BookOpen aria-hidden="true" />
              <h3>Pour les parents</h3>
              <p>
                Préparez la prochaine visite avec les rendez-vous, les mesures
                de croissance et les vaccinations déjà documentées.
              </p>
              <Link href="/signup" className="homepage-inline-link">
                Créer un compte parent <ArrowRight aria-hidden="true" />
              </Link>
            </article>
            <article>
              <Stethoscope aria-hidden="true" />
              <h3>Pour les soignants</h3>
              <p>
                Retrouvez les dossiers auxquels vous avez accès, documentez vos
                consultations et confrontez les repères vaccinaux calculés à vos
                registres.
              </p>
              <Link
                href="/login?audience=clinician"
                className="homepage-inline-link"
              >
                Accéder à l’espace soignant <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>

        <section
          className="homepage-section homepage-privacy"
          id="securite"
          aria-labelledby="privacy-title"
        >
          <div className="homepage-shell homepage-privacy-layout">
            <header className="homepage-section-heading">
              <p className="homepage-kicker">Confidentialité</p>
              <h2 id="privacy-title">Vous décidez quand partager le carnet</h2>
              <p>
                Un parent autorisé peut ouvrir un partage temporaire pour un
                professionnel habilité et le révoquer depuis son espace.
              </p>
            </header>
            <ul>
              <li>
                <LockKeyhole aria-hidden="true" />
                <span>
                  <strong>Accès lié à une invitation</strong>Le soignant vérifie
                  votre qualité de responsable avant d’ouvrir le carnet.
                </span>
              </li>
              <li>
                <QrCode aria-hidden="true" />
                <span>
                  <strong>QR temporaire</strong>Le QR ouvre la procédure de
                  partage. Le professionnel doit s’identifier pour accéder aux
                  informations autorisées.
                </span>
              </li>
              <li>
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Accès consultables</strong>Retrouvez vos partages
                  actifs dans « Partage & accès ».
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section
          className="homepage-shell homepage-section homepage-founders"
          id="fondateurs"
          aria-labelledby="founders-title"
        >
          <div className="homepage-founder-copy">
            <header className="homepage-section-heading">
              <p className="homepage-kicker">Les fondateurs</p>
              <h2 id="founders-title">Deux métiers, des racines à Belfaa</h2>
              <p>
                Originaires de Belfaa, dans la province de Chtouka-Aït Baha,
                nous réunissons le développement et le soin autour d’une même
                idée. Nous aidons les familles à retrouver les informations
                utiles au suivi de leur enfant.
              </p>
            </header>
            <div className="homepage-founder-bios">
              {founders.map(({ name, role, bio }) => (
                <article className="homepage-founder" key={name}>
                  <p className="homepage-founder-role">{role}</p>
                  <h3>{name}</h3>
                  <p>{bio}</p>
                </article>
              ))}
            </div>
          </div>
          <figure className="homepage-founder-visual">
            <Image
              src="/brand/fondateurs-mon-enfant.webp"
              alt="Les deux cofondateurs de Mon Enfant, côte à côte dans un couloir"
              width={1122}
              height={1402}
              sizes="(max-width: 800px) 92vw, 39vw"
            />
            <figcaption>
              <MapPin aria-hidden="true" /> Belfaa · Chtouka-Aït Baha, Maroc
            </figcaption>
          </figure>
        </section>

        <section
          className="homepage-section homepage-contact"
          id="aide"
          aria-labelledby="contact-title"
        >
          <div className="homepage-shell homepage-contact-layout">
            <header className="homepage-section-heading">
              <p className="homepage-kicker">Contact</p>
              <h2 id="contact-title">Parlons de Mon Enfant</h2>
              <p>
                Une question sur le carnet, un retour d’expérience ou une idée
                de collaboration ? Écrivez-nous.
              </p>
              <p className="homepage-contact-help">
                Pour protéger votre enfant, évitez d’envoyer des informations
                médicales par e-mail ou WhatsApp.
              </p>
            </header>
            <address className="homepage-contact-links">
              {founders.map(({ name, whatsapp, phone }) => (
                <a
                  key={name}
                  href={whatsapp}
                  aria-label={`Écrire à ${name} sur WhatsApp au ${phone}`}
                >
                  <MessageCircle aria-hidden="true" />
                  <span>
                    <strong>{name}</strong>
                    <span>WhatsApp · {phone}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" />
                </a>
              ))}
              <a href={`mailto:${contactEmail}`}>
                <Mail aria-hidden="true" />
                <span>
                  <strong>Nous écrire par e-mail</strong>
                  <span>{contactEmail}</span>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </a>
            </address>
          </div>
        </section>
      </main>
      <footer className="homepage-shell homepage-footer">
        <div>
          <strong>Mon Enfant</strong>
          <p>En développement · Données de santé fictives uniquement</p>
        </div>
        <nav aria-label="Liens utiles">
          <a href="#securite">Confidentialité et partage</a>
          <a href="#aide">Contact</a>
          <Link href="/forgot-password">Retrouver l’accès à mon compte</Link>
          <Link href="/login?audience=clinician">
            Espace soignant <ArrowUpRight aria-hidden="true" />
          </Link>
        </nav>
      </footer>
    </div>
  );
}
