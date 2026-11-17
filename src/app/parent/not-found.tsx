import Link from "next/link";
export default function ParentNotFound() {
  return (
    <main className="account-page">
      <section className="account-card">
        <h1 id="main-content" tabIndex={-1}>
          Carnet indisponible
        </h1>
        <p>Ce lien est invalide ou votre accès n’est plus actif.</p>
        <Link className="button" href="/parent">
          Revenir à mon espace
        </Link>
      </section>
    </main>
  );
}
