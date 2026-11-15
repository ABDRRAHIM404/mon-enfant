import Link from "next/link";
import { UsersRound } from "lucide-react";
type Choice = { id: string; label: string; caption: string };
export function ClinicianChildPicker({
  base,
  q,
  page,
  total,
  items,
  current,
  privateRecords = false,
}: {
  base: string;
  q: string;
  page: number;
  total: number;
  items: Choice[];
  current?: { id: string; label: string } | null;
  privateRecords?: boolean;
}) {
  const pageHref = (n: number) =>
    `${base}?${new URLSearchParams({ q, childPage: String(n) })}`;
  const childHref = (id: string) =>
    `${base}?${new URLSearchParams({ q, child: id, childPage: String(page) })}`;
  const search = (
    <form action={base} className="soignant-child-search">
      <label>
        {privateRecords
          ? "Rechercher dans mes dossiers privés"
          : "Rechercher dans mes dossiers autorisés"}
        <input type="search" name="q" maxLength={100} defaultValue={q} />
      </label>
      <button className="button secondary">Rechercher</button>
      {q && (
        <Link className="text-link" href={base}>
          Réinitialiser
        </Link>
      )}
    </form>
  );
  const pagination = (
    <nav className="pagination" aria-label="Enfants à sélectionner">
      {page > 1 && <Link href={pageHref(page - 1)}>Précédents</Link>}
      <span>{total} dossier(s)</span>
      {page * 30 < total && <Link href={pageHref(page + 1)}>Suivants</Link>}
    </nav>
  );
  return (
    <aside className="panel soignant-selector">
      <h2>Sélectionner un enfant</h2>
      <div className="soignant-desktop-picker">
        {search}
        <div className="soignant-child-list">
          {items.map((c) => (
            <Link
              key={c.id}
              href={childHref(c.id)}
              aria-current={current?.id === c.id ? "page" : undefined}
            >
              <UsersRound size={25} aria-hidden="true" />
              <span>
                {c.label}
                <small>{c.caption}</small>
              </span>
            </Link>
          ))}
        </div>
        {!items.length && <p>Aucun dossier ne correspond à ces critères.</p>}
        {pagination}
      </div>
      <details className="soignant-phone-picker">
        <summary>{current ? "Changer d’enfant" : "Choisir un enfant"}</summary>
        <form action={base} className="soignant-child-search">
          <input type="hidden" name="q" value={q} />
          <input type="hidden" name="childPage" value={page} />
          <label>
            Enfant de cette liste
            <select name="child" defaultValue={current?.id || ""} required>
              <option value="" disabled>
                Choisir un dossier
              </option>
              {current && !items.some((c) => c.id === current.id) && (
                <option value={current.id}>{current.label}</option>
              )}
              {items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary">Afficher cet enfant</button>
        </form>
        {search}
        {pagination}
      </details>
    </aside>
  );
}
