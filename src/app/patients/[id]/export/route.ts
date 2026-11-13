import { NextResponse } from 'next/server';
import { requireApprovedDoctor } from '@/lib/auth';
import { uuidPattern } from '@/lib/registry/types';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const{supabase}=await requireApprovedDoctor();const{id}=await params;if(!uuidPattern.test(id))return NextResponse.json({error:'Dossier indisponible.'},{status:404,headers});
 const[profile,ledger]=await Promise.all([supabase.rpc('get_child_profile',{p_child_id:id}),supabase.rpc('clinical_export',{p_child_id:id})]);
 if(profile.error?.code==='42501'||ledger.error?.code==='42501')return NextResponse.json({error:'Dossier indisponible.'},{status:404,headers});
 if(profile.error||ledger.error)return NextResponse.json({error:ledger.error?.code==='54000'?'La limite interactive est dépassée. Utilisez une procédure d’export autorisée avec un périmètre convenu.':'Export indisponible.'},{status:ledger.error?.code==='54000'?413:503,headers});
 return NextResponse.json({format:'mon-enfant-clinical-ledger-v1',generated_at:new Date().toISOString(),synthetic_environment:true,scope:'demographics_and_clinical_entries_including_all_amendments',vaccination_module_included:false,child:profile.data,clinical_entries:ledger.data},{headers:{...headers,'Content-Disposition':'attachment; filename="mon-enfant-clinical-summary.json"'}});
}
