import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
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
import "./homepage.css";

export const metadata: Metadata = {
  title: "Mon Enfant · Le carnet de santé de votre enfant",
  description:
    "Découvrez Mon Enfant, un carnet de santé numérique pour le suivi des vaccinations, de la croissance et des rendez-vous. Un projet de deux cofondateurs originaires de Belfaa.",
};

const clinicianLogin = "/login?audience=clinician";

const features = [
  {
    title: "Vaccinations",
    photo: "/brand/home-vaccination.webp",
    alt: "Une infirmière prépare un vaccin pendant qu’un parent rassure son enfant",
    Icon: Syringe,
  },
  {
    title: "Croissance",
    photo: "/brand/home-growth.webp",
    alt: "Un soignant mesure la taille d’un enfant à l’aide d’une toise",
    Icon: ChartNoAxesCombined,
  },
];

const audiences = [
  {
    title: "Espace parent",
    label: "Carnet de mon enfant",
    href: "/login",
    Icon: BookOpen,
    entries: [
      { Icon: Syringe, label: "Vaccinations documentées", detail: "12 nov." },
      { Icon: ChartNoAxesCombined, label: "Dernière mesure", detail: "71 cm" },
      { Icon: CalendarDays, label: "Prochain rendez-vous", detail: "10 déc." },
    ],
  },
  {
    title: "Espace soignant",
    label: "Ma journée de soins",
    href: clinicianLogin,
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
    <div className="home-audience-grid">
      {audiences.map(({ title, label, href, Icon, entries }) => (
        <article key={title} className="home-audience">
          <div className="home-audience-screen">
            <header>
              <Icon size={22} aria-hidden="true" />
              <h3>{label}</h3>
              <small>Exemple</small>
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
          <Link href={href} className="home-audience-link">
            {title} <ArrowUpRight aria-hidden="true" />
          </Link>
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
              Le carnet de santé <em>qui grandit avec eux.</em>
            </h1>
            <div className="homepage-actions">
              <Link href="/login" className="button primary">
                <BookOpen aria-hidden="true" /> Espace parent
              </Link>
              <Link href={clinicianLogin} className="button secondary">
                <Stethoscope aria-hidden="true" /> Espace soignant
              </Link>
            </div>
          </div>
          <div className="homepage-hero-visual home-photo-pair">
            <figure>
              <Image
                src="/brand/home-parent.webp"
                width={768}
                height={512}
                priority
                sizes="(max-width: 800px) 47vw, 27vw"
                alt="Une mère et sa fille regardent leur téléphone ensemble"
              />
              <figcaption>
                <BookOpen aria-hidden="true" /> Le carnet en famille
              </figcaption>
            </figure>
            <figure>
              <Image
                src="/brand/home-clinician.webp"
                width={768}
                height={512}
                priority
                sizes="(max-width: 800px) 47vw, 27vw"
                alt="Une soignante consulte une tablette avec un parent et son enfant au cabinet"
              />
              <figcaption>
                <Stethoscope aria-hidden="true" /> Le suivi au cabinet
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          className="homepage-section home-feature-section"
          id="fonctionnalites"
          aria-labelledby="feature-heading"
        >
          <div className="homepage-shell">
            <header className="homepage-section-heading">
              <h2 id="feature-heading">Les soins, en un coup d’œil</h2>
            </header>
            <div className="home-feature-photos">
              {features.map(({ Icon, alt, photo, title }) => (
                <figure key={title}>
                  <Image
                    src={photo}
                    alt={alt}
                    width={768}
                    height={512}
                    sizes="(max-width: 540px) 92vw, (max-width: 900px) 47vw, 29vw"
                  />
                  <figcaption>
                    <Icon aria-hidden="true" /> {title}
                  </figcaption>
                </figure>
              ))}
              <figure className="home-calendar-visual">
                <div aria-hidden="true" className="home-calendar-demo">
                  <CalendarDays size={32} />
                  <div className="home-calendar-days">
                    {[8, 9, 10, 11, 12, 13, 14].map((day) => (
                      <span key={day} data-highlight={day === 10}>
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="home-calendar-slot">
                    <span>09:00</span> Consultation
                  </div>
                  <div className="home-calendar-slot">
                    <span>10:30</span> Vaccination
                  </div>
                </div>
                <figcaption>
                  <CalendarDays aria-hidden="true" /> Rendez-vous
                </figcaption>
              </figure>
            </div>
            <AudiencePreviews />
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
