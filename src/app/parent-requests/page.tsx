import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import {
  CorrectionList,
  RequestPagination,
} from "@/components/parents/correction-list";
import type { CorrectionPage } from "@/lib/parents/types";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function ParentRequests({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const page = Number((await searchParams).page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) notFound();
  const { data, error } = await supabase.rpc("doctor_parent_corrections", {
    p_page: page,
  });
  if (error)
    throw new Error("Impossible de charger les demandes des responsables.");
  const view = data as CorrectionPage;
  return (
    <main className="account-page wide">
      <DoctorNav />
      <section className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Demandes des responsables
        </h1>
        <p>
          Demandes pour les enfants dont vous gérez actuellement les accès. Les
          réponses sont conservées ; une correction clinique doit être
          enregistrée dans son circuit habituel.
        </p>
      </section>
      <CorrectionList data={view} />
      <RequestPagination total={view.total} page={page} />
    </main>
  );
}
