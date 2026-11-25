"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RegistryFilterSelect } from "../registry-filter-select";
import "../registry-filter-select.css";

const sortOptions = [
  { value: "recent", label: "Plus récente" },
  { value: "oldest", label: "Plus ancienne (cette page)" },
];

export function ConsultationSort({
  href,
  params,
  sort,
}: {
  href: string;
  params: Record<string, string>;
  sort: string;
}) {
  const router = useRouter();
  const [pending, transition] = useTransition();

  return (
    <form className="consultation-sort" action={href} aria-busy={pending}>
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
          transition(() => router.push(`${href}?${query}`, { scroll: false }));
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
