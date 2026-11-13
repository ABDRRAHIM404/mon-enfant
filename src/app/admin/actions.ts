"use server";
import { revalidatePath } from "next/cache";
import { requireReviewer } from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
export type ReviewState = { error?: string; success?: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function reviewApplication(_: ReviewState, form: FormData): Promise<ReviewState> {
  const { supabase } = await requireReviewer();
  const id = String(form.get("requestId") ?? "");
  const decision = String(form.get("decision") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!uuid.test(id) || !["approved","rejected","needs_more_evidence"].includes(decision) || reason.length < 10 || reason.length > 1000) return { error: "Sélectionnez une décision et indiquez un motif de 10 à 1 000 caractères." };
  const { error } = await supabase.rpc("review_verification", { p_request_id:id, p_decision:decision, p_reason:reason, p_identity_checked:form.get("identityChecked")==="on", p_registration_checked:form.get("registrationChecked")==="on" });
  if (error) {
    if (error.code === "22023") return { error: "La demande a déjà changé, ou les contrôles requis pour l’approbation sont incomplets. Rechargez le dossier et vérifiez les cases de contrôle." };
    const reference=reportOperationalEvent("verification_review_failed");
    return { error:`La décision n’a pas pu être enregistrée. Référence : ${reference}` };
  }
  revalidatePath("/admin/verifications"); revalidatePath(`/admin/verifications/${id}`); revalidatePath("/admin/professionals");
  return { success:true };
}
export async function setSuspension(_: ReviewState, form: FormData): Promise<ReviewState> {
  const { supabase } = await requireReviewer();
  const id=String(form.get("userId") ?? "");
  const reason=String(form.get("reason") ?? "").trim();
  const action=String(form.get("action") ?? "");
  if (!uuid.test(id) || reason.length < 10 || reason.length > 1000 || !["suspend","reactivate"].includes(action)) return { error:"Indiquez un motif de 10 à 1 000 caractères." };
  const { error }=await supabase.rpc("set_professional_suspension",{ p_user_id:id, p_suspend:action==="suspend", p_reason:reason });
  if (error) { const reference=reportOperationalEvent("account_status_failed"); return { error:`La modification n’a pas pu être enregistrée. Rechargez la liste. Référence : ${reference}` }; }
  revalidatePath("/admin/professionals");return { success:true };
}
