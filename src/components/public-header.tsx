import Link from "next/link";
import { Menu } from "lucide-react";
import { Brand } from "./brand";

const sections = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#fondateurs", label: "Les fondateurs" },
  { href: "/#aide", label: "Contact" },
];

export function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <nav className="public-links" aria-label="Découvrir Mon Enfant">
        {sections.map(({ href, label }) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <nav className="public-actions" aria-label="Accéder à mon compte">
        <Link href="/login" className="button primary">
          Espace parent
        </Link>
        <Link
          href="/login?audience=clinician"
          className="public-clinician-link"
        >
          Espace soignant
        </Link>
      </nav>
      <details className="public-menu">
        <summary aria-label="Ouvrir le menu">
          <Menu size={22} aria-hidden="true" />
        </summary>
        <nav aria-label="Menu mobile">
          {sections.map(({ href, label }) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          <Link href="/login">Espace parent</Link>
          <Link href="/signup">Créer un compte parent</Link>
          <Link href="/login?audience=clinician">Espace soignant</Link>
        </nav>
      </details>
    </header>
  );
}
