import Link from "next/link";
import { Menu } from "lucide-react";
import { Brand } from "./brand";
export function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <nav className="public-links" aria-label="Découvrir Mon Enfant">
        <Link href="/">Accueil</Link>
        <Link href="/#fonctionnalites">Fonctionnalités</Link>
        <Link href="/#securite">Sécurité</Link>
        <Link href="/#aide">Aide</Link>
      </nav>
      <nav className="public-actions" aria-label="Accéder à mon compte">
        <Link href="/login" className="button primary">
          Espace parent
        </Link>
        <Link href="/login?audience=clinician" className="button secondary">
          Espace soignant
        </Link>
      </nav>
      <details className="public-menu">
        <summary aria-label="Ouvrir le menu">
          <Menu size={22} aria-hidden="true" />
        </summary>
        <nav aria-label="Menu mobile">
          <Link href="/">Accueil</Link>
          <Link href="/#fonctionnalites">Fonctionnalités</Link>
          <Link href="/login">Espace parent</Link>
          <Link href="/signup">Créer un compte parent</Link>
          <Link href="/login?audience=clinician">Espace soignant</Link>
          <Link href="/#aide">Aide</Link>
        </nav>
      </details>
    </header>
  );
}
