import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
import { CorrectionRequestForm } from "@/components/parents/request-forms";
import {
  CorrectionList,
  RequestPagination,
} from "@/components/parents/correction-list";
import type { CorrectionPage } from "@/lib/parents/types";
export const dynamic = "force-dynamic";
export default async function Requests({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; entry?: string }>;
}) {
  const { supabase } = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const page = Number(query.page ?? 1);
  if (
    !uuidPattern.test(id) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000 ||
    (query.entry && !uuidPattern.test(query.entry))
  )
    notFound();
  const { data, error } = await supabase.rpc("parent_corrections", {
    p_child_id: id,
    p_page: page,
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Impossible de charger les demandes.");
  const view = data as CorrectionPage;
  return (
    <main className="account-page wide">
      <Link href={`/parent/children/${id}`}>← Carnet de mon enfant</Link>
      <section className="panel">
        <h1 id="main-content" tabIndex={-1}>
          Demander une vérification ou correction
        </h1>
        <CorrectionRequestForm
          childId={id}
          operationId={randomUUID()}
          entryId={query.entry}
        />
      </section>
      <h2>Mes demandes pour ce carnet</h2>
      <CorrectionList data={view} parent />
      <RequestPagination total={view.total} page={page} />
    </main>
  );
}
