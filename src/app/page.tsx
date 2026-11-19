import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Mail,
  LockKeyhole,
  MapPin,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { HomeFeatureAnimation } from "@/components/home-feature-animation";
import "./homepage.css";

export const metadata: Metadata = {
  title: "Mon Enfant · Le carnet de santé de votre enfant",
  description:
    "Mon Enfant est un logiciel de suivi pour les familles et leurs professionnels de santé. Retrouvez les vaccinations, les mesures de croissance et les rendez-vous dans le carnet numérique.",
};

const clinicianLogin = "/login?audience=clinician";

const audiences = [
  {
    title: "Espace parent",
    label: "Carnet de mon enfant",
    Icon: BookOpen,
    entries: [
      { Icon: Syringe, label: "Vaccinations documentées", detail: "12 nov." },
      { Icon: ChartNoAxesCombined, label: "Dernière mesure", detail: "71 cm" },
      { Icon: CalendarDays, label: "Prochain rendez-vous", detail: "10 déc." },
    ],
  },
  {
    title: "Espace soignant",
    label: "Agenda du soignant",
    Icon: Stethoscope,
    entries: [
      { Icon: CalendarDays, label: "Consultation de suivi", detail: "09:00" },
      { Icon: Syringe, label: "Rendez-vous vaccinal", detail: "10:30" },
      {
        Icon: ChartNoAxesCombined,
        label: "Suivi de croissance",
        detail: "11:15",
      },
    ],
  },
];

function AudiencePreviews() {
  return (
    <div
      className="homepage-hero-visual home-product-stage"
      aria-label="Aperçus du logiciel Mon Enfant"
    >
      {audiences.map(({ title, label, Icon, entries }) => (
        <article key={title} className="home-audience">
          <div className="home-audience-screen">
            <div className="home-window-bar" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <header>
              <Icon size={22} aria-hidden="true" />
              <h2>{label}</h2>
              <small>Exemple fictif</small>
            </header>
            <ul>
              {entries.map(({ Icon: EntryIcon, label: entryLabel, detail }) => (
                <li key={entryLabel}>
                  <EntryIcon size={17} aria-hidden="true" />
                  <span>{entryLabel}</span>
                  <strong>{detail}</strong>
                </li>
              ))}
            </ul>
          </div>
          <p className="home-audience-label">{title}</p>
        </article>
      ))}
    </div>
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
              Son carnet de santé, <em>en ligne.</em>
            </h1>
            <p className="homepage-intro">
              Le logiciel de suivi qui réunit les informations enregistrées par
              vos professionnels de santé.
            </p>
            <div className="homepage-actions">
              <Link href="/login" className="button primary">
                <BookOpen aria-hidden="true" /> Espace parent
              </Link>
              <Link href={clinicianLogin} className="button secondary">
                <Stethoscope aria-hidden="true" /> Espace soignant
              </Link>
            </div>
          </div>
          <AudiencePreviews />
        </section>

        <section
          className="homepage-section home-feature-section"
          id="fonctionnalites"
          aria-labelledby="feature-heading"
        >
          <div className="homepage-shell">
            <header className="homepage-section-heading">
              <h2 id="feature-heading">Le suivi, en un coup d’œil</h2>
              <p>
                Vos professionnels de santé assurent les soins et renseignent le
                carnet.
              </p>
            </header>
            <div className="home-demo-audiences">
              <section
                className="home-demo-audience"
                aria-labelledby="demos-parent"
              >
                <div className="home-demo-audience-copy">
                  <BookOpen aria-hidden="true" />
                  <h3 id="demos-parent">Espace parent</h3>
                  <p>
                    Consultez les informations enregistrées dans le carnet de
                    votre enfant.
                  </p>
                  <Link href="/login" className="home-demo-entry">
                    Accéder à l’espace parent{" "}
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </div>
                <div className="home-feature-panels">
                  <HomeFeatureAnimation
                    name="vaccinations"
                    description="Consulter les vaccinations de mon enfant"
                  />
                  <HomeFeatureAnimation
                    name="croissance"
                    description="Suivre sa courbe de croissance"
                  />
                </div>
              </section>
              <section
                className="home-demo-audience home-demo-audience-clinical"
                aria-labelledby="demos-clinician"
              >
                <div className="home-demo-audience-copy">
                  <Stethoscope aria-hidden="true" />
                  <h3 id="demos-clinician">Espace soignant</h3>
                  <p>
                    Médecins et infirmiers organisent leur agenda et renseignent
                    les carnets auxquels ils ont accès.
                  </p>
                  <Link href={clinicianLogin} className="home-demo-entry">
                    Accéder à l’espace soignant{" "}
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </div>
                <div className="home-feature-panels">
                  <HomeFeatureAnimation
                    name="agenda"
                    description="Consulter l’agenda du cabinet"
                  />
                  <HomeFeatureAnimation
                    name="saisie-vaccination"
                    description="Documenter une vaccination"
                  />
                </div>
              </section>
            </div>
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
                  <strong>Invitation vérifiée</strong>
                </span>
              </li>
              <li>
                <QrCode aria-hidden="true" />
                <span>
                  <strong>QR temporaire</strong>Accès réservé au professionnel
                  identifié.
                </span>
              </li>
              <li>
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Partages révocables</strong>Depuis « Partage & accès
                  ».
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
          <p>Bêta de test · Données de santé fictives uniquement</p>
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
