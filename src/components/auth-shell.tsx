import Link from "next/link";
import { ShieldCheck, LockKeyhole, HeartHandshake } from "lucide-react";
import { Brand } from "./brand";
import { AuthForm } from "./auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
export function AuthShell({ mode }: { mode: "login" | "signup" }) {
  const configured = !!supabaseConfig();
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow light">ESPACE PROFESSIONNEL</span>
          <p className="story-title">
            Une histoire de santé.
            <br />
            Toute une enfance.
          </p>
          <p>
            Un carnet de santé continu, pour accompagner chaque enfant et
            faciliter le suivi des professionnels.
          </p>
          <div className="story-feature">
            <HeartHandshake />
            <span>Un enfant, un dossier, une continuité de soins.</span>
          </div>
          <div className="story-feature">
            <ShieldCheck />
            <span>Des accès encadrés et des actions traçables.</span>
          </div>
        </div>
        <p className="story-footer">
          Conçu pour les professionnels de santé au Maroc.
        </p>
      </section>
      <section className="auth-main">
        <Link className="back-link" href="/">
          ← Retour à l’accueil
        </Link>
        <div className="auth-card">
          <span className="eyebrow">MON ENFANT · PROFESSIONNELS</span>
          <h1 id="main-content" tabIndex={-1}>
            {mode === "login"
              ? "Heureux de vous retrouver."
              : "Votre espace commence ici."}
          </h1>
          <p className="muted">
            {mode === "login"
              ? "Connectez-vous à votre espace sécurisé."
              : "Créez votre compte professionnel."}
          </p>
          {!configured && (
            <div className="notice">
              <LockKeyhole size={20} />
              <div>
                <strong>Configuration en cours</strong>
                <p>
                  La connexion sera disponible après le raccordement de
                  Supabase. Aucune donnée de santé n’est accessible.
                </p>
              </div>
            </div>
          )}
          <AuthForm mode={mode} configured={configured} />
          <p className="auth-switch">
            {mode === "login" ? "Vous nous rejoignez ?" : "Déjà un compte ?"}{" "}
            <Link href={mode === "login" ? "/signup" : "/login"}>
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </Link>
          </p>
        </div>
        <p className="fine auth-bottom">
          <LockKeyhole size={13} /> Environnement de développement · Données
          fictives uniquement
        </p>
      </section>
    </main>
  );
}
