import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Syringe,
  ChartNoAxesCombined,
  CalendarDays,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header";
const features = [
  {
    Icon: Syringe,
    title: "Vaccinations",
    description: "Calendrier, historique et rappels.",
  },
  {
    Icon: ChartNoAxesCombined,
    title: "Croissance",
    description: "Mesures et courbes de suivi.",
  },
  {
    Icon: CalendarDays,
    title: "Rendez-vous",
    description: "Prochains soins et consultations.",
  },
  {
    Icon: FileText,
    title: "Documents",
    description: "Carnet et documents médicaux.",
  },
];
export default function Home() {
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="eyebrow">CARNET DE SANTÉ NUMÉRIQUE · MAROC</span>
            <h1 id="main-content" tabIndex={-1}>
              Le carnet de santé de votre enfant, <em>à portée de main.</em>
            </h1>
            <p className="muted">
              Vaccinations, consultations, croissance et prochains rendez-vous.
              Un suivi clair pour les parents, dans un seul espace sécurisé.
            </p>
            <div className="landing-actions">
              <Link href="/login" className="button primary">
                Accéder à mon espace parent <ArrowRight size={17} />
              </Link>
              <Link href="/signup" className="button secondary">
                Créer un compte parent
              </Link>
            </div>
            <p className="clinician-entry">
              Vous êtes médecin ou infirmier(ère) ?{" "}
              <Link href="/login?audience=clinician">
                Espace soignant <ArrowRight size={14} />
              </Link>
            </p>
          </div>
          <figure className="family-card">
            <Image
              src="/brand/family.png"
              alt="Une mère et son enfant partagent un moment de tendresse."
              width={560}
              height={476}
              sizes="(max-width: 700px) 90vw, 40vw"
              priority
            />
            <figcaption>
              <strong>Sa santé. Son histoire. Toujours avec vous.</strong>
              <p>Un carnet qui grandit avec votre enfant.</p>
            </figcaption>
          </figure>
        </section>
        <section
          className="landing-features"
          id="fonctionnalites"
          aria-label="Les fonctionnalités du carnet"
        >
          {features.map(({ Icon, title, description }) => (
            <article className="feature-card" key={title}>
              <span className="round-icon">
                <Icon size={25} aria-hidden="true" />
              </span>
              <h2>{title}</h2>
              <p className="muted">{description}</p>
            </article>
          ))}
        </section>
        <section className="landing-guidance" id="securite">
          <ShieldCheck size={24} aria-hidden="true" />
          <div>
            <h2>Un carnet partagé, des accès autorisés.</h2>
            <p>
              Une invitation sécurisée et une vérification de votre qualité de
              responsable sont nécessaires pour relier un carnet existant. Votre
              inscription ne crée pas de dossier médical.
            </p>
          </div>
        </section>
        <section className="landing-help" id="aide">
          <h2>Besoin d’aide pour commencer ?</h2>
          <p>
            Créez votre compte parent, puis utilisez l’invitation remise par un
            soignant autorisé.{" "}
            <Link className="text-link" href="/forgot-password">
              Retrouver l’accès à mon compte
            </Link>
            .
          </p>
        </section>
      </main>
      <footer className="site-footer landing-footer">
        <span>
          © 2026 Mon Enfant · En développement · Données fictives uniquement
        </span>
        <Link href="/login?audience=clinician">
          Espace soignant <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
