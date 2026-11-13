import { NextResponse } from 'next/server';
import { requireApprovedDoctor } from '@/lib/auth';
import { uuidPattern } from '@/lib/registry/types';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const{supabase}=await requireApprovedDoctor();const{id}=await params;if(!uuidPattern.test(id))return NextResponse.json({error:'Dossier indisponible.'},{status:404,headers});
 const[profile,ledger]=await Promise.all([supabase.rpc('get_child_profile',{p_child_id:id}),supabase.rpc('clinical_export',{p_child_id:id})]);
 if(profile.error?.code==='42501'||ledger.error?.code==='42501')return NextResponse.json({error:'Dossier indisponible.'},{status:404,headers});
 if(profile.error||ledger.error)return NextResponse.json({error:ledger.error?.code==='54000'?'La limite interactive est dépassée. Utilisez une procédure d’export autorisée avec un périmètre convenu.':'Export indisponible.'},{status:ledger.error?.code==='54000'?413:503,headers});
 const metadata={format:'mon-enfant-clinical-ledger-v1',generated_at:new Date().toISOString(),synthetic_environment:true,scope:'demographics_and_clinical_entries_including_all_amendments',vaccination_module_included:false,child:profile.data};
 const entries=ledger.data as unknown[];const encoder=new TextEncoder();let index=0;
 const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(encoder.encode(JSON.stringify(metadata).slice(0,-1)+',"clinical_entries":['));},pull(controller){if(index<entries.length){controller.enqueue(encoder.encode((index?',':'')+JSON.stringify(entries[index])));index++;}else{controller.enqueue(encoder.encode(']}'));controller.close();}}});
 return new Response(stream,{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="mon-enfant-clinical-summary.json"'}});
}
