import Link from "next/link";
export default function NotFound() {
  return (
    <main className="account-page">
      <h1 id="main-content" tabIndex={-1}>
        Dossier indisponible
      </h1>
      <p>
        Ce dossier n’est pas disponible pour cette session. Vérifiez vos
        autorisations ou revenez à votre espace.
      </p>
      <Link className="button secondary" href="/account">
        Mon compte soignant
      </Link>
    </main>
  );
}
