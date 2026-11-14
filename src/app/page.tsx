import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Fingerprint,
  ClipboardCheck,
  HeartPulse,
  Check,
  Circle,
} from "lucide-react";
import { Brand } from "@/components/brand";
export default function Home() {
  return (
    <div className="home">
      <header className="site-header">
        <Brand />
        <nav aria-label="Navigation principale">
          <Link href="/login?audience=clinician">Espace soignant</Link>
          <Link href="/login">Se connecter</Link>
          <Link href="/signup" className="button primary small">
            Créer un compte <ArrowRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-text">
            <span className="eyebrow">
              <span className="dot" /> CARNET DE SANTÉ NUMÉRIQUE · MAROC
            </span>
            <h1 id="main-content" tabIndex={-1}>
              Grandir en confiance.
              <br />
              <em>Soigner en continuité.</em>
            </h1>
            <p>
              Un même carnet de santé tout au long de l’enfance. Un espace
              parent pour consulter le carnet partagé de votre enfant et suivre
              ses rendez-vous.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="button primary">
                Accéder à mon espace <ArrowRight size={18} />
              </Link>
              <span className="fine">Parents et responsables autorisés</span>
            </div>
            <div className="hero-note">
              <ShieldCheck size={17} /> En développement · Données fictives
              uniquement
            </div>
          </div>
          <div className="booklet">
            <div className="booklet-top">
              <HeartPulse size={22} />
              <span>MON ENFANT</span>
              <span className="booklet-dot" />
            </div>
            <div className="booklet-content">
              <span className="eyebrow">UN SUIVI QUI SE TRANSMET</span>
              <h2>Chaque étape compte.</h2>
              <p>
                Une identité permanente.
                <br />
                Une histoire de soins continue.
              </p>
              <div className="booklet-line">
                <span className="round-icon">
                  <Fingerprint size={22} />
                </span>
                <div>
                  <strong>Un enfant, un identifiant</strong>
                  <span>À travers les lieux de soins</span>
                </div>
                <Check size={16} />
              </div>
              <div className="booklet-line">
                <span className="round-icon">
                  <ClipboardCheck size={22} />
                </span>
                <div>
                  <strong>Des soins traçables</strong>
                  <span>Chaque professionnel identifié</span>
                </div>
                <Check size={16} />
              </div>
              <div className="booklet-line">
                <span className="round-icon">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <strong>Des accès autorisés</strong>
                  <span>Au plus près du besoin de soin</span>
                </div>
                <Check size={16} />
              </div>
            </div>
            <div className="booklet-footer">
              LE CARNET QUI GRANDIT AVEC LUI <span>✳</span>
            </div>
          </div>
        </section>
        <section className="foundation">
          <div>
            <span className="eyebrow">ÉTAPE ACTUELLE</span>
            <h2>Le carnet de votre enfant.</h2>
            <p className="muted">
              Créez votre espace parent. Un carnet existant vous sera partagé
              après une invitation sécurisée et une vérification de votre
              qualité de responsable.
            </p>
          </div>
          <ol className="milestones">
            <li className="current">
              <span>01</span>
              <div>
                <strong>Un compte parent</strong>
                <p>Connexion et préférences personnelles</p>
              </div>
              <span className="pill">Parents</span>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Un lien autorisé</strong>
                <p>
                  Invitation et vérification de votre qualité de responsable
                </p>
              </div>
              <Circle size={17} />
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Le carnet partagé</strong>
                <p>Soins, vaccinations et rendez-vous autorisés</p>
              </div>
              <Circle size={17} />
            </li>
          </ol>
        </section>
      </main>
      <footer className="site-footer">
        <span>© 2026 Mon Enfant</span>
        <span>Projet en développement · Données fictives</span>
        <Link href="/login?audience=clinician">
          Espace soignant <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
