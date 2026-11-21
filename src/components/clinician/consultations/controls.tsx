"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { RegistryFilterSelect } from "../registry-filter-select";
import "../registry-filter-select.css";

const sortOptions = [
  { value: "recent", label: "Plus récente" },
  { value: "oldest", label: "Plus ancienne (cette page)" },
];

export function ConsultationSearch({
  query,
  sort,
}: {
  query: string;
  sort: string;
}) {
  const router = useRouter();
  const [pending, transition] = useTransition();
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      q: String(data.get("q") ?? ""),
      sort,
    });
    transition(() =>
      router.push(`/consultations?${params}`, { scroll: false }),
    );
  }

  return (
    <form
      className="consultation-search"
      action="/consultations"
      onSubmit={search}
      aria-busy={pending}
    >
      <label htmlFor="consultation-child-search">
        Rechercher dans mes dossiers autorisés
      </label>
      <div className="consultation-search-field">
        <input
          id="consultation-child-search"
          name="q"
          type="search"
          maxLength={100}
          placeholder="Nom, identifiant, registre…"
          defaultValue={query}
        />
        <input type="hidden" name="sort" value={sort} />
        <button
          type="submit"
          aria-label="Rechercher un enfant"
          disabled={pending}
        >
          <Search size={20} aria-hidden="true" />
        </button>
      </div>
      <span className="sr-only" role="status">
        {pending ? "Recherche en cours…" : ""}
      </span>
    </form>
  );
}

export function ConsultationSort({
  params,
  sort,
}: {
  params: Record<string, string>;
  sort: string;
}) {
  const router = useRouter();
  const [pending, transition] = useTransition();

  return (
    <form
      className="consultation-sort"
      action="/consultations"
      aria-busy={pending}
    >
      {Object.entries(params).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <RegistryFilterSelect
        name="sort"
        label="Trier par"
        defaultValue={sort}
        options={sortOptions}
        onValueChange={(value) => {
          if (value === sort || pending) return;
          const query = new URLSearchParams({ ...params, sort: value });
          transition(() =>
            router.push(`/consultations?${query}`, { scroll: false }),
          );
        }}
      />
      <span className="sr-only" role="status">
        {pending ? "Tri en cours…" : ""}
      </span>
      <noscript>
        <button type="submit">Appliquer le tri</button>
      </noscript>
    </form>
  );
}
