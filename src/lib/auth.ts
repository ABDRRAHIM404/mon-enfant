import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { supabaseConfig } from "./supabase/config";
import { canAccessClinicalWorkspace, type Professional } from "./authorization";
export async function requireUser() {
  if (!supabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) redirect("/login");
  return { user, supabase };
}
export async function getProfessional() {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("user_id,role,verification_status,professional_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Impossible de charger le statut professionnel.");
  return { user, profile: data as Professional | null, supabase };
}
export async function requireApprovedDoctor() {
  const result = await getProfessional();
  if (!canAccessClinicalWorkspace(result.profile)) redirect("/account");
  return result;
}

export async function requireReviewer() {
  const result = await getProfessional();
  if (result.profile?.role !== "admin" || result.profile.verification_status !== "approved") redirect("/account");
  const { data, error } = await result.supabase.rpc("can_review_professionals");
  if (error || data !== true) redirect("/account");
  return result;
}

export async function requireClinicalPermissionManager() {
  const result=await getProfessional();
  if(result.profile?.role!=='admin'||result.profile.verification_status!=='approved') redirect('/account');
  const {data,error}=await result.supabase.rpc('can_manage_clinical_permissions');
  if(error||data!==true) redirect('/account');
  return result;
}
