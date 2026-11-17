export default function ParentLoading() {
  return (
    <main className="account-page wide" aria-busy="true" aria-live="polite">
      <h1 id="main-content" tabIndex={-1}>
        Chargement de votre espace parent…
      </h1>
      <p>Vos informations autorisées sont en cours de chargement.</p>
      <div className="parent-loading-grid" aria-hidden="true">
        {[1, 2, 3].map((item) => (
          <div className="parent-loading-card" key={item} />
        ))}
      </div>
    </main>
  );
}
