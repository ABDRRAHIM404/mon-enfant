"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { historyLabels } from "@/lib/registry/types";

export type RegistryQuery = {
  q: string;
  history: string;
  age: string;
  sort: string;
  view: string;
  page: number;
};

function useRegistryNavigation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of data) params.set(key, String(value));
    const href = `/patients?${params}`;
    if (href === location.pathname + location.search) return;
    startTransition(() => router.push(href, { scroll: false }));
  }

  return { pending, submit };
}

export function RegistryFilters({ query }: { query: RegistryQuery }) {
  const { pending, submit } = useRegistryNavigation();
  return (
    <form
      className="registry-directory-filters"
      action="/patients"
      aria-label="Rechercher dans le registre"
      onSubmit={submit}
      aria-busy={pending}
    >
      <input type="hidden" name="sort" value={query.sort} />
      <input type="hidden" name="view" value={query.view} />
      <label>
        Nom, identifiant, contact ou numéro local
        <span className="registry-directory-search">
          <Search size={19} aria-hidden="true" />
          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query.q}
            placeholder="Ex. : Ahmed, 272, 06…"
          />
        </span>
      </label>
      <label>
        <span id="registry-history-label">Historique</span>
        <select
          name="history"
          aria-labelledby="registry-history-label"
          defaultValue={query.history}
        >
          <option value="all">Tous les dossiers</option>
          {Object.entries(historyLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span id="registry-age-label">Âge (date exacte)</span>
        <select
          name="age"
          aria-labelledby="registry-age-label"
          defaultValue={query.age}
        >
          <option value="all">Tous les âges</option>
          <option value="under1">Moins de 1 an</option>
          <option value="1to5">1 à 5 ans</option>
          <option value="over5">6 ans et plus</option>
          <option value="unknown">Date inconnue / estimée</option>
        </select>
      </label>
      <button
        type="submit"
        className="registry-directory-submit"
        disabled={pending}
      >
        <Search size={20} aria-hidden="true" />
        {pending ? "Recherche…" : "Rechercher"}
      </button>
      <span className="registry-visually-hidden" role="status">
        {pending ? "Recherche des dossiers en cours" : ""}
      </span>
    </form>
  );
}

export function RegistrySort({ query }: { query: RegistryQuery }) {
  const { pending, submit } = useRegistryNavigation();
  return (
    <form
      className="registry-directory-sort"
      action="/patients"
      onSubmit={submit}
      aria-busy={pending}
    >
      <input type="hidden" name="q" value={query.q} />
      <input type="hidden" name="history" value={query.history} />
      <input type="hidden" name="age" value={query.age} />
      <input type="hidden" name="page" value={query.page} />
      <input type="hidden" name="view" value={query.view} />
      <label>
        <span id="registry-sort-label">Trier par</span>
        <select
          name="sort"
          aria-labelledby="registry-sort-label"
          defaultValue={query.sort}
          disabled={pending}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          <option value="recent">Plus récent</option>
          <option value="name">Nom (cette page)</option>
        </select>
      </label>
      <noscript>
        <button type="submit">Appliquer le tri</button>
      </noscript>
    </form>
  );
}
