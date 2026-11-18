import { DashboardHeading } from "@/components/dashboard/heading";
import { ParentWorkflow } from "@/components/parents/workflow";
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
import type { CorrectionPage, ParentWorkspaceData } from "@/lib/parents/types";
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
  const [corrections, workspace] = await Promise.all([
    supabase.rpc("parent_corrections", { p_child_id: id, p_page: page }),
    supabase.rpc("parent_workspace"),
  ]);
  const { data, error } = corrections;
  if (workspace.error)
    throw Error("Impossible de confirmer le carnet de votre enfant.");
  const child = (workspace.data as ParentWorkspaceData).children.find(
    (child) => child.id === id,
  );
  if (!child) notFound();
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Impossible de charger les demandes.");
  const view = data as CorrectionPage;
  return (
    <ParentWorkflow
      active="requests"
      childId={id}
      childSection="requests"
      child={child}
    >
      <Link href={`/parent/children/${id}`}>← Carnet de mon enfant</Link>
      <DashboardHeading
        title="Demandes et réponses"
        description="Posez une question ou signalez une information à vérifier. Le professionnel conserve la responsabilité des soins enregistrés."
        section="access"
      />
      <section className="panel">
        <h2>Nouvelle demande</h2>
        <CorrectionRequestForm
          childId={id}
          operationId={randomUUID()}
          entryId={query.entry}
        />
      </section>
      <h2>Mes demandes pour ce carnet</h2>
      <CorrectionList data={view} parent />
      <RequestPagination total={view.total} page={page} />
    </ParentWorkflow>
  );
}
