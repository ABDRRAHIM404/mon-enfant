"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="account-page">
      <section className="account-card">
        <h1 id="main-content" tabIndex={-1}>Service momentanément indisponible</h1>
        <p>
          Votre demande n’a pas pu aboutir. Réessayez dans quelques instants.
        </p>
        <button className="button primary" onClick={reset}>
          Réessayer
        </button>
      </section>
    </main>
  );
}
