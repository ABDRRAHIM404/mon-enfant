import { NextResponse } from "next/server";
import { requireReviewer } from "@/lib/auth";
import { EVIDENCE_BUCKET } from "@/lib/verification/validation";
export async function GET(_:Request,{ params }: { params:Promise<{ id:string }> }) {
  const { supabase }=await requireReviewer();const { id }=await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Dossier introuvable",{status:404});
  const { data:request,error }=await supabase.from("verification_requests").select("evidence_path").eq("id",id).maybeSingle();
  if (error || !request) return new NextResponse("Dossier introuvable",{status:404});
  const { error:auditError }=await supabase.rpc("record_evidence_access",{ p_request_id:id });
  if (auditError) return new NextResponse("Accès au document indisponible",{status:403});
  const { data,error:signedError }=await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(request.evidence_path,60,{download:true});
  if (signedError || !data) return new NextResponse("Document indisponible",{status:404});
  const response=NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control","private, no-store");response.headers.set("Referrer-Policy","no-referrer");return response;
}
