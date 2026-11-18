import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
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

const services = [
  {
    Icon: Syringe,
    title: "Vaccinations",
    description: "Doses documentées et repères du calendrier vaccinal",
  },
  {
    Icon: ChartNoAxesCombined,
    title: "Croissance",
    description:
      "Évolution du poids, de la taille et autres mesures enregistrées",
  },
  {
    Icon: ClipboardList,
    title: "Consultations",
    description: "Historique des visites et informations de suivi partagées",
  },
  {
    Icon: CalendarDays,
    title: "Rendez-vous",
    description: "Dates et informations des rendez-vous enregistrés",
  },
];

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
              Un carnet de santé qui <em>grandit avec votre enfant</em>
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
              <a href="#fonctionnalites" className="homepage-jump">
                Voir comment ça marche <ArrowDown aria-hidden="true" />
              </a>
            </div>
            <p className="homepage-care-link">
              <Link href="/login?audience=clinician">
                Accéder à l’espace soignant <ArrowUpRight aria-hidden="true" />
              </Link>
            </p>
          </div>
          <figure className="homepage-hero-visual">
            <Image
              src="/brand/family.png"
              alt="Une mère serre son enfant dans ses bras"
              width={560}
              height={476}
              sizes="(max-width: 800px) 92vw, 45vw"
              priority
            />
          </figure>
        </section>

        <section
          className="homepage-section homepage-journey"
          id="fonctionnalites"
          aria-labelledby="journey-title"
        >
          <div className="homepage-shell">
            <header className="homepage-section-heading homepage-reveal">
              <p className="homepage-kicker">Le parcours parent</p>
              <h2 id="journey-title">Du compte au carnet, en trois étapes</h2>
              <p>
                Une fois le carnet relié, gardez les informations de suivi à
                portée de main entre les visites.
              </p>
            </header>
            <ol className="homepage-steps" role="list">
              {steps.map(({ Icon, title, description }, index) => (
                <li className="homepage-step homepage-reveal" key={title}>
                  <div className="homepage-step-marker" aria-hidden="true">
                    <Icon />
                    <span>0{index + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
            <div className="homepage-ledger homepage-reveal">
              <h3>Dans le carnet</h3>
              <ul role="list">
                {services.map(({ Icon, title, description }) => (
                  <li key={title}>
                    <Icon aria-hidden="true" />
                    <div>
                      <h4>{title}</h4>
                      <p>{description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <aside className="homepage-access" id="securite">
              <ShieldCheck aria-hidden="true" />
              <p>
                <strong>Des accès vérifiés.</strong> La création d’un compte
                parent ne crée pas de dossier médical.
              </p>
              <Link href="/signup" className="homepage-inline-link">
                Créer un compte parent <ArrowRight aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </section>

        <section
          className="homepage-shell homepage-section homepage-founders"
          id="fondateurs"
          aria-labelledby="founders-title"
        >
          <div className="homepage-founder-copy">
            <header className="homepage-section-heading homepage-reveal">
              <p className="homepage-kicker">Les fondateurs</p>
              <h2 id="founders-title">Deux métiers, des racines à Belfaa</h2>
              <p>
                Originaires de Belfaa, dans la province de Chtouka-Aït Baha,
                nous réunissons le développement et le soin autour d’une même
                idée : aider les familles à retrouver les informations utiles au
                suivi de leur enfant.
              </p>
            </header>
            <div className="homepage-founder-bios">
              {founders.map(({ name, role, bio }) => (
                <article
                  className="homepage-founder homepage-reveal"
                  key={name}
                >
                  <p className="homepage-founder-role">{role}</p>
                  <h3>{name}</h3>
                  <p>{bio}</p>
                </article>
              ))}
            </div>
          </div>
          <figure className="homepage-founder-visual homepage-reveal">
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
            <header className="homepage-section-heading homepage-reveal">
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
            <address className="homepage-contact-links homepage-reveal">
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
          <Link href="/forgot-password">Retrouver l’accès à mon compte</Link>
          <Link href="/login?audience=clinician">
            Espace soignant <ArrowUpRight aria-hidden="true" />
          </Link>
        </nav>
      </footer>
    </div>
  );
}
