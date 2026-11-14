import Link from "next/link";
import { ShieldCheck, LockKeyhole, HeartHandshake } from "lucide-react";
import { Brand } from "./brand";
import { AuthForm } from "./auth-form";
import { supabaseConfig } from "@/lib/supabase/config";
export function AuthShell({
  mode,
  parent = true,
  invitation = false,
}: {
  mode: "login" | "signup";
  parent?: boolean;
  invitation?: boolean;
}) {
  const configured = !!supabaseConfig();
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow light">
            {parent ? "ESPACE PARENT" : "ESPACE SOIGNANT"}
          </span>
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
          {parent
            ? "Un carnet partagé avec les professionnels qui suivent votre enfant."
            : "Pour les médecins et infirmier(e)s au Maroc."}
        </p>
      </section>
      <section className="auth-main">
        <Link className="back-link" href="/">
          ← Retour à l’accueil
        </Link>
        <div className="auth-card">
          <span className="eyebrow">
            {parent ? "MON ENFANT · PARENTS" : "MÉDECINS ET INFIRMIER(E)S"}
          </span>
          <h1 id="main-content" tabIndex={-1}>
            {mode === "login"
              ? "Heureux de vous retrouver."
              : "Votre espace commence ici."}
          </h1>
          <p className="muted">
            {mode === "login"
              ? "Connectez-vous à votre espace sécurisé."
              : parent
                ? "Créez votre compte parent. Aucun carnet ne sera ouvert avant vérification."
                : "Créez votre compte soignant. Déclarez ensuite votre métier dans votre espace."}
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
          <AuthForm
            mode={mode}
            configured={configured}
            destination={
              parent ? (invitation ? "parent-invitation" : "parent") : "account"
            }
          />
          <p className="auth-switch">
            {mode === "login" ? "Vous nous rejoignez ?" : "Déjà un compte ?"}{" "}
            <Link
              href={
                (mode === "login" ? "/signup" : "/login") +
                (parent
                  ? invitation
                    ? "?audience=parent&next=invitation"
                    : ""
                  : "?audience=clinician")
              }
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </Link>
          </p>
          <p className="auth-switch">
            <Link href={parent ? "/login?audience=clinician" : "/login"}>
              {parent
                ? "Espace soignant · Médecins et infirmier(e)s"
                : "Accéder à l’espace parent"}
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
