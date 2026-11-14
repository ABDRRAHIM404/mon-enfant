import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  CorrectionList,
  RequestPagination,
} from "@/components/parents/correction-list";
import type { CorrectionPage } from "@/lib/parents/types";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Requests({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireUser();
  const page = Number((await searchParams).page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) notFound();
  const { data, error } = await supabase.rpc("parent_corrections", {
    p_page: page,
  });
  if (error) throw new Error("Impossible de charger les demandes.");
  const view = data as CorrectionPage;
  return (
    <main className="account-page wide">
      <Link href="/parent">← Mon espace parent</Link>
      <section className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Mes demandes et réponses
        </h1>
        <p>
          Vos demandes pour les carnets auxquels vous avez actuellement accès.
          Elles ne modifient pas les soins enregistrés.
        </p>
      </section>
      <CorrectionList data={view} parent />
      <RequestPagination total={view.total} page={page} />
    </main>
  );
}
