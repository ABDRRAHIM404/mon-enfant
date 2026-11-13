import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { registryDatabase, sessionActing } from './helpers/database';
let db:PGlite;
type Actor={id:string;session:string};
async function actor(role='doctor',status='approved'):Promise<Actor> {
  const id=randomUUID(),session=randomUUID();
  await db.query('insert into auth.users(id) values ($1)',[id]);
  await db.query('insert into auth.sessions(id,user_id) values ($1,$2)',[session,id]);
  await db.query('insert into public.professional_profiles(user_id,role,verification_status,professional_id) values ($1,$2,$3,$4)',[id,role,status,status==='approved'?`TEST-${id}`:null]);
  return {id,session};
}
async function call(a:Actor,name:string,args:unknown[]=[]) {
  const result=await sessionActing(db,a.id,a.session,`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as value`,args);
  return (result.rows[0] as {value:unknown}).value;
}
async function facility(a:Actor) { return await call(a,'create_facility',[randomUUID(),'Centre fictif','Rabat']) as string; }
function payload(f:string,number='00125') { return {facility_id:f,register_year:2026,register_book:'A',local_number:number,given_name:'Enfant',family_name:'Fictif',birth_date:'2025-01-02',sex:'unknown',history_status:'unknown'}; }
async function registered() {
  const a=await actor(),f=await facility(a),p=payload(f);
  const child=await call(a,'register_child',[randomUUID(),p]) as string;
  const profile=await call(a,'get_child_profile',[child]) as {universal_id:string;registers:{number:string}[]};
  return {a,f,p,child,profile};
}
beforeAll(async()=>{db=await registryDatabase();});
afterAll(async()=>{await db.close();});
describe('fully migrated patient registry',()=>{
  it('keeps all public tables under RLS and denies direct patient reads',async()=>{
    const a=await actor();
    const tables=await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'");
    expect(tables.rows.every(t=>t.relrowsecurity)).toBe(true);
    for (const table of ['children','facilities','doctor_patient_registry','access_grants','child_access_requests','child_access_changes','audit_events']) await expect(sessionActing(db,a.id,a.session,`select * from public.${table}`)).rejects.toThrow(/permission denied/);
  });
  it('requires a current matching unexpired session, approval and doctor role',async()=>{
    const a=await actor();
    for (const session of ['',randomUUID(),'malformed']) await expect(call({...a,session},'my_facilities')).rejects.toThrow(/active session/i);
    const b=await actor();await expect(call({...a,session:b.session},'my_facilities')).rejects.toThrow(/active session/i);
    await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[a.session]);
    await expect(call(a,'my_facilities')).rejects.toThrow(/active session/i);
    for (const status of ['unverified','under_review','rejected','suspended']) await expect(call(await actor('doctor',status),'my_facilities')).rejects.toThrow(/Approved doctor/);
    await expect(call(await actor('admin'),'my_facilities')).rejects.toThrow(/Approved doctor/);
  });
  it('creates child, creator management grant and raw local number atomically; retries once',async()=>{
    const a=await actor(),f=await facility(a),p=payload(f),op=randomUUID();
    const child=await call(a,'register_child',[op,p]);
    expect(await call(a,'register_child',[op,p])).toBe(child);
    await expect(call(a,'register_child',[op,{...p,local_number:'other'}])).rejects.toThrow(/reused/);
    expect(await call(a,'get_child_profile',[child])).toMatchObject({can_manage_access:true,history_status:'unknown',registers:[{number:'00125'}]});
    expect(await call(a,'registry_summary')).toMatchObject({patients:1,uncertain_history:1,facilities:1});
  });
  it('rolls back conflicts and rejects undeclared practices and unknown payload fields',async()=>{
    const {a,f,p}=await registered();
    await expect(call(a,'register_child',[randomUUID(),{...p,given_name:'Autre'}])).rejects.toThrow(/unique constraint/);
    expect(await call(a,'registry_summary')).toMatchObject({patients:1});
    await expect(call(a,'register_child',[randomUUID(),{...p,facility_id:await facility(await actor())}])).rejects.toThrow(/membership/);
    await expect(call(a,'register_child',[randomUUID(),{...p,can_manage_access:true}])).rejects.toThrow(/Invalid registration/);
    expect(f).toBeTruthy();
  });
  it('retains unknown paper demographics and requires paper provenance',async()=>{
    const a=await actor(),f=await facility(a),p={...payload(f),given_name:null,family_name:null,birth_date:null,name_status:'unknown',birth_date_precision:'unknown',source_type:'paper_transcription'};
    await expect(call(a,'register_child',[randomUUID(),p])).rejects.toThrow(/children_paper_reference/);
    const child=await call(a,'register_child',[randomUUID(),{...p,paper_reference:'Registre fictif page 12'}]);
    expect(await call(a,'get_child_profile',[child])).toMatchObject({given_name:null,birth_date:null,source_type:'paper_transcription',history_status:'unknown'});
    const result=await call(a,'list_patients',['','all','unknown',1]) as {total:number};expect(result.total).toBe(1);
  });
  it('requires human duplicate review only within authorized records',async()=>{
    const {a,p}=await registered();
    await expect(call(a,'register_child',[randomUUID(),{...p,local_number:'126'}])).rejects.toThrow(/Possible duplicate/);
    const separate=await call(a,'register_child',[randomUUID(),{...p,local_number:'126',duplicate_override_reason:'Deux enfants distincts, contrôle fictif.'}]);expect(separate).toBeTruthy();
    const b=await actor();expect(await call(b,'register_child',[randomUUID(),payload(await facility(b))])).toBeTruthy();
  });
  it('scopes search and audits successful reads without clinical payloads',async()=>{
    const {a,child}=await registered(),b=await actor();
    expect(await call(a,'list_patients',['00125','unknown','all',1])).toMatchObject({total:1});
    expect(await call(b,'list_patients',['Enfant','all','all',1])).toMatchObject({total:0,items:[]});
    await expect(call(b,'get_child_profile',[child])).rejects.toThrow(/denied/);
    const audit=await db.query("select entity_type,action from public.audit_events where entity_id=$1 and action='accessed'",[child]);expect(audit.rows.length).toBeGreaterThan(0);
  });
  it('does not disclose existence in requester receipts or allow self approval',async()=>{
    const {a,child,profile}=await registered(),b=await actor(),f=await facility(b);
    const request=await call(b,'request_child_access',[randomUUID(),profile.universal_id,f,2026,'B','78','Autorisation de soins fictive.']);
    const missing=await call(b,'request_child_access',[randomUUID(),randomUUID(),f,2026,'B','79','Autorisation de soins fictive.']);
    const receipts=await call(b,'my_access_requests') as {id:string;child_id:null}[];
    expect(receipts).toHaveLength(2);expect(receipts.every(r=>r.child_id===null)).toBe(true);expect(missing).toBeTruthy();
    await expect(call(b,'decide_child_access',[request,true,'Autorisation vérifiée fictivement.',true,false])).rejects.toThrow(/manager/);
    await expect(call(a,'decide_child_access',[request,true,'Autorisation vérifiée fictivement.',false,false])).rejects.toThrow(/must be checked/);
    expect(await call(a,'decide_child_access',[request,true,'Autorisation vérifiée fictivement.',true,false])).toBe(child);
    expect(await call(b,'get_child_profile',[child])).toMatchObject({universal_id:profile.universal_id,can_manage_access:false,registers:[{number:'78'}]});
    expect(await call(a,'get_child_profile',[child])).toMatchObject({registers:[{number:'00125'}]});
    await expect(call(a,'decide_child_access',[request,true,'Nouvelle décision fictive.',true,false])).rejects.toThrow(/already decided/);
    await expect(call(b,'child_access_grants',[child])).rejects.toThrow(/manager/);
    await call(a,'revoke_child_access',[child,b.id,'Fin de prise en charge fictive.']);
    await expect(call(b,'get_child_profile',[child])).rejects.toThrow(/denied/);
    expect(await call(b,'registry_summary')).toMatchObject({patients:0});
    await expect(db.query('delete from public.child_access_changes where child_id=$1',[child])).rejects.toThrow(/Append-only/);
  });
  it('rolls back access approval when local numbering conflicts',async()=>{
    const {a,child,profile}=await registered(),b=await actor(),f=await facility(b);
    await call(b,'register_child',[randomUUID(),{...payload(f,'78'),given_name:'Autre'}]);
    const request=await call(b,'request_child_access',[randomUUID(),profile.universal_id,f,2026,'A','78','Demande fictive pour le test.']);
    await expect(call(a,'decide_child_access',[request,true,'Autorisation vérifiée fictivement.',true,false])).rejects.toThrow(/unique constraint/);
    await expect(call(b,'get_child_profile',[child])).rejects.toThrow(/denied/);
    expect(await call(b,'my_access_requests')).toMatchObject([{status:'pending',child_id:null}]);
    await call(b,'withdraw_child_access',[request,'Numéro de registre à corriger.']);
    expect(await call(b,'my_access_requests')).toMatchObject([{status:'withdrawn'}]);
  });
  it('rechecks membership at decision and revocation/session state on every read',async()=>{
    const {a,child,profile}=await registered(),b=await actor(),f=await facility(b);
    const request=await call(b,'request_child_access',[randomUUID(),profile.universal_id,f,2026,'A','78','Demande fictive pour le test.']);
    await db.query('update public.professional_facilities set revoked_at=now() where professional_id=$1',[b.id]);
    await expect(call(a,'decide_child_access',[request,true,'Autorisation vérifiée fictivement.',true,false])).rejects.toThrow(/eligible/);
    await db.query('delete from auth.sessions where id=$1',[a.session]);
    await expect(call(a,'get_child_profile',[child])).rejects.toThrow(/denied/);
    expect((await sessionActing(db,a.id,a.session,'select * from public.professional_profiles')).rows).toEqual([]);
  });
  it('protects existing reviewer and evidence operations after logout',async()=>{
    const reviewer=await actor('admin');
    await db.query('insert into private.staff_permissions(user_id,can_review_professionals) values($1,true)',[reviewer.id]);
    expect(await call(reviewer,'can_review_professionals')).toBe(true);
    await db.query('delete from auth.sessions where id=$1',[reviewer.session]);
    expect(await call(reviewer,'can_review_professionals')).toBe(false);
    const a=await actor('doctor','unverified');await db.query('delete from auth.sessions where id=$1',[a.session]);
    await expect(call(a,'submit_verification',[randomUUID(),'Docteur Fictif','FICTIF','Centre Fictif','no-file'])).rejects.toThrow(/Active session/);
    expect((await sessionActing(db,a.id,a.session,'select * from storage.objects')).rows).toEqual([]);
  });
});
