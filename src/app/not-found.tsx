import Link from "next/link";
export default function NotFound() {
  return (
    <main className="account-page">
      <section className="account-card">
        <span className="eyebrow">MON ENFANT · 404</span>
        <h1>Cette page est introuvable.</h1>
        <p className="muted">Retrouvez votre espace depuis l’accueil.</p>
        <Link className="button primary" href="/">
          Retour à l’accueil
        </Link>
      </section>
    </main>
  );
}
