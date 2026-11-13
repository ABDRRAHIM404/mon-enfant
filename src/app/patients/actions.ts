'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireApprovedDoctor } from '@/lib/auth';
import { reportOperationalEvent } from '@/lib/operational-events';
import { uuidPattern } from '@/lib/registry/types';
export type RegistryState={error?:string;success?:boolean;duplicate?:boolean};
export async function registryAction(_:RegistryState,form:FormData):Promise<RegistryState> {
  const {supabase}=await requireApprovedDoctor();
  const text=(key:string)=>String(form.get(key)??'').trim();
  const kind=text('kind');
  const operation=text('operationId');
  const mutations=['facility','register','link','request'];
  if (mutations.includes(kind) && !uuidPattern.test(operation)) return {error:'Identifiant d’opération invalide. Rechargez la page.'};
  let rpc:string;
  let args:Record<string,unknown>;
  if(kind==='facility') {rpc='create_facility';args={p_operation_id:operation,p_name:text('name'),p_city:text('city')};}
  else if(kind==='register') {
    if(text('syntheticOnly')!=='on') return {error:'Confirmez l’utilisation de données fictives.'};
    const fields=['facility_id','register_book','local_number','given_name','family_name','name_status','birth_date','birth_date_precision','sex','history_status','source_type','paper_reference','provenance_note','guardian_name','guardian_phone','duplicate_override_reason'];
    const payload:Record<string,unknown>=Object.fromEntries(fields.map(key=>[key,text(key)]));payload.register_year=Number(text('register_year'));
    rpc='register_child';args={p_operation_id:operation,p_payload:payload};
  } else if(kind==='link'||kind==='request') {
    if(!uuidPattern.test(text('universal_id'))||!uuidPattern.test(text('facility_id'))) return {error:'Identifiant universel ou lieu d’exercice invalide.'};
    rpc=kind==='link'?'link_child':'request_child_access';args={p_operation_id:operation,p_universal_id:text('universal_id'),p_facility_id:text('facility_id'),p_year:Number(text('register_year')),p_book:text('register_book'),p_number:text('local_number')};
    if(kind==='request') args.p_reason=text('reason');
  } else if(kind==='decide') {rpc='decide_child_access';args={p_request_id:text('requestId'),p_approve:text('decision')==='approve',p_reason:text('reason'),p_authorization_checked:text('authorizationChecked')==='on',p_delegate:text('delegate')==='on'};if(!['approve','reject'].includes(text('decision'))) return {error:'Choisissez une décision.'};}
  else if(kind==='withdraw') {rpc='withdraw_child_access';args={p_request_id:text('requestId'),p_reason:text('reason')};}
  else if(kind==='revoke') {rpc='revoke_child_access';args={p_child_id:text('childId'),p_professional_id:text('professionalId'),p_reason:text('reason')};}
  else return {error:'Action inconnue.'};
  const {data,error}=await supabase.rpc(rpc,args);
  if(error) {
    if(error.code==='P0002') return {duplicate:true,error:'Un dossier autorisé porte les mêmes nom, prénom et date. Consultez votre registre avant de créer un autre enfant. Si les enfants sont distincts, indiquez le motif ci-dessous.'};
    if(error.code==='23505') return {error:'Ce numéro est déjà utilisé dans ce registre, ou une demande est déjà en attente. Vérifiez avant de réessayer.'};
    if(['23514','23502','22023','22007','22P02'].includes(error.code??'')) return {error:'Vérifiez les champs, les degrés de certitude, le motif et la référence papier. La saisie n’a pas été enregistrée.'};
    if(error.code==='42501') return {error:'Votre autorisation actuelle ne permet pas cette action. Vérifiez votre session, le lieu d’exercice et les accès du dossier.'};
    const ref=reportOperationalEvent('registry_action_failed');return {error:`L’opération n’a pas abouti. Réessayez avec les mêmes champs. Référence : ${ref}`};
  }
  for(const path of ['/dashboard','/patients','/practices','/access-requests']) revalidatePath(path);
  if(text('childId')&&uuidPattern.test(text('childId'))) revalidatePath(`/patients/${text('childId')}`);
  if((kind==='register'||kind==='link')&&typeof data==='string'&&uuidPattern.test(data)) redirect(`/patients/${data}`);
  return {success:true};
}
