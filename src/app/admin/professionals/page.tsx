import { requireReviewer } from "@/lib/auth";
import { statusLabels } from "@/lib/authorization";
import type { VerificationState } from "@/lib/authorization";
import { AdminNav } from "@/components/verification/admin-nav";
import { SuspensionForm } from "@/components/verification/review-form";
import Link from "next/link";
export const dynamic="force-dynamic";
export default async function Professionals({ searchParams }: { searchParams:Promise<{ page?:string }> }) {
  const { supabase }=await requireReviewer();const query=await searchParams;
  const page=Math.max(1,Math.min(10000,Number.parseInt(query.page ?? "1",10)||1));
  const { data:profiles,error,count }=await supabase.from("professional_profiles").select("user_id,professional_id,verification_status,created_at",{count:"exact"}).eq("role","doctor").order("created_at",{ascending:false}).range((page-1)*20,page*20-1);
  if (error) throw new Error("Impossible de charger les professionnels.");
  return <main className="account-page wide"><AdminNav/><section className="page-heading"><span className="eyebrow">ADMINISTRATION</span><h1>Comptes professionnels</h1><p className="muted">La suspension coupe l’accès clinique immédiatement. Toute modification nécessite un motif.</p></section><section className="panel"><p className="fine">{count ?? 0} compte(s) · Page {page}</p><div className="record-list">{!profiles?.length ? <p className="empty-state">Aucun compte professionnel.</p> : profiles.map(p => <article key={p.user_id}><strong>{p.professional_id ?? "Professionnel non vérifié"}</strong><p className="fine">Compte : {p.user_id}</p><p className="status">{statusLabels[p.verification_status as VerificationState]}</p>{["approved","suspended"].includes(p.verification_status) && <SuspensionForm key={p.verification_status} userId={p.user_id} suspended={p.verification_status==="suspended"}/>}</article>)}</div><div className="pagination">{page>1 && <Link href={`?page=${page-1}`}>← Précédent</Link>}{(count ?? 0)>page*20 && <Link href={`?page=${page+1}`}>Suivant →</Link>}</div></section></main>;
}
