import Link from "next/link";
import { UsersRound, Stethoscope, LockKeyhole } from "lucide-react";
import { PublicHeader } from "./public-header";
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
  const Icon = parent ? UsersRound : Stethoscope;
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="auth-layout">
        <section
          className="auth-story"
          aria-label={
            parent ? "Un carnet pour votre famille" : "Médecin / Infirmier(ère)"
          }
        >
          <div className="story-copy">
            <Icon
              className="auth-illustration-icon"
              size={96}
              strokeWidth={1.3}
              aria-hidden="true"
            />
            <h2>
              {parent
                ? "Votre famille, au cœur du suivi"
                : mode === "signup"
                  ? "Rejoignez Mon Enfant"
                  : "Un espace dédié aux soignants"}
            </h2>
            <p>
              {parent
                ? "Retrouvez le carnet de santé et les rendez-vous de vos enfants."
                : mode === "signup"
                  ? "Créez votre compte soignant. La vérification professionnelle peut être soumise ensuite."
                  : "Pour les médecins et infirmier(ère)s."}
            </p>
          </div>
        </section>
        <section className="auth-main">
          <div className="auth-card">
            <span className="eyebrow">
              {parent ? "ESPACE PARENT" : "MÉDECIN / INFIRMIER(ÈRE)"}
            </span>
            <h1 id="main-content" tabIndex={-1}>
              {mode === "login"
                ? "Se connecter"
                : parent
                  ? "Créer mon compte"
                  : "Créer un compte"}
            </h1>
            <p className="muted">
              {mode === "login"
                ? parent
                  ? "Accédez à votre espace parent sécurisé."
                  : "Accédez à votre espace médecin / infirmier(ère)."
                : parent
                  ? "Un compte parent, avant de relier un carnet existant."
                  : "Confirmez votre e-mail, puis ouvrez votre espace privé avec un statut non vérifié."}
            </p>
            {!parent && mode === "login" && (
              <p className="notice clinician-notice">
                Vous n’êtes pas encore vérifié ? Vous pouvez utiliser votre
                espace. Vos dossiers restent provisoires et privés.
              </p>
            )}
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
                parent
                  ? invitation
                    ? "parent-invitation"
                    : "parent"
                  : "account"
              }
            />
            <p className="auth-switch">
              {mode === "login"
                ? "Vous n’avez pas de compte ?"
                : "Déjà un compte ?"}{" "}
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
                {mode === "login"
                  ? parent
                    ? "Créer un compte parent"
                    : "Créer un compte soignant"
                  : "Se connecter"}
              </Link>
            </p>
            <p className="auth-switch">
              <Link href={parent ? "/login?audience=clinician" : "/login"}>
                {parent
                  ? "Espace soignant · Médecin / Infirmier(ère)"
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
    </div>
  );
}
