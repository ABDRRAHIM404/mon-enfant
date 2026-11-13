import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { verificationDatabase,acting } from "./helpers/database";
import { evidenceExtension,validateApplication,normalizeRegistration } from "../src/lib/verification/validation";
let db:PGlite;let reviewer:string;let ordinaryAdmin:string;
async function profile(role="doctor",status="unverified",permission=false) {
  const id=randomUUID();
  await db.query("insert into auth.users(id) values ($1)",[id]);
  await db.query("insert into public.professional_profiles(user_id,role,verification_status,professional_id) values ($1,$2,$3,$4)",[id,role,status,status==="approved" ? `TEST-${id}` : null]);
  if (permission) await db.query("insert into private.staff_permissions(user_id,can_review_professionals) values ($1,true)",[id]);
  return id;
}
async function evidence(user:string,request:string) { const path=`${user}/${request}/evidence.pdf`;await db.query("insert into storage.objects(bucket_id,name) values ('professional-evidence',$1)",[path]);return path; }
async function submit(user:string,registration=`REG-${randomUUID()}`) {
  const id=randomUUID();const path=await evidence(user,id);
  await acting(db,user,`select public.submit_verification('${id}','Docteur Fictif','${registration}','Centre Fictif','${path}')`);
  return {id,path};
}
async function review(id:string,decision="approved",identity=true,registration=true,actor=reviewer) {
  return acting(db,actor,`select public.review_verification('${id}','${decision}','Contrôles fictifs effectués et documentés.',${identity},${registration})`);
}
beforeAll(async()=>{ db=await verificationDatabase();reviewer=await profile("admin","approved",true);ordinaryAdmin=await profile("admin","approved"); });
afterAll(async()=>{ await db.close(); });
describe("private professional verification",()=>{
  it("creates a private bucket with file limits",async()=>{
    const r=await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='professional-evidence'");
    expect(r.rows).toEqual([{public:false,file_size_limit:5242880,allowed_mime_types:["application/pdf","image/jpeg","image/png"]}]);
  });
  it("keeps RLS on all exposed tables",async()=>{
    const r=await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'");
    expect(r.rows).toHaveLength(9);expect(r.rows.every(v=>v.relrowsecurity)).toBe(true);
  });
  it("requires evidence and leaves the account unchanged after failure",async()=>{
    const user=await profile();const id=randomUUID();
    await expect(acting(db,user,`select public.submit_verification('${id}','Docteur Test','REG-NOFILE','Centre Test','${user}/${id}/evidence.pdf')`)).rejects.toThrow("Private evidence is required");
    expect((await acting(db,user,"select verification_status from public.professional_profiles")).rows).toEqual([{verification_status:"unverified"}]);
  });
  it("cannot submit another account’s evidence",async()=>{
    const owner=await profile();const attacker=await profile();const id=randomUUID();const path=await evidence(owner,id);
    await expect(acting(db,attacker,`select public.submit_verification('${id}','Docteur Test','REG-WRONG','Centre Test','${path}')`)).rejects.toThrow("Private evidence is required");
  });
  it("moves a submitted account under review without granting clinical access",async()=>{
    const user=await profile();await submit(user);
    expect((await acting(db,user,"select verification_status from public.professional_profiles")).rows).toEqual([{verification_status:"under_review"}]);
    expect((await acting(db,user,"select id from public.children")).rows).toEqual([]);
    await expect(submit(user)).rejects.toThrow("Submission not permitted");
  });
  it("blocks normalized duplicate matricules across pending accounts",async()=>{
    const first=await profile();const second=await profile();await submit(first,"reg-001");
    await expect(submit(second,"REG-001")).rejects.toThrow(/unique constraint/);
    expect((await acting(db,second,"select verification_status from public.professional_profiles")).rows[0]).toEqual({verification_status:"unverified"});
  });
  it("cannot bypass submission RPC through direct table writes",async()=>{
    const user=await profile();await expect(acting(db,user,"insert into public.verification_requests(id) values (gen_random_uuid())")).rejects.toThrow(/permission denied/);
  });
  it("does not treat the admin role alone as evidence-review permission",async()=>{
    expect((await acting(db,ordinaryAdmin,"select public.can_review_professionals() as allowed")).rows).toEqual([{allowed:false}]);
    const user=await profile();const {id}=await submit(user);await expect(review(id,"approved",true,true,ordinaryAdmin)).rejects.toThrow("Reviewer permission required");
  });
  it("prevents doctor self-approval and cross-account request reads",async()=>{
    const user=await profile();const stranger=await profile();const {id}=await submit(user);
    await expect(review(id,"approved",true,true,user)).rejects.toThrow("Reviewer permission required");
    expect((await acting(db,stranger,`select id from public.verification_requests where id='${id}'`)).rows).toEqual([]);
  });
  it("requires both identity and registration checks before approval",async()=>{
    const user=await profile();const {id}=await submit(user);
    await expect(review(id,"approved",false,true)).rejects.toThrow("Identity and registration must be checked");
    await expect(review(id,"approved",true,false)).rejects.toThrow("Identity and registration must be checked");
    expect((await acting(db,user,"select verification_status from public.professional_profiles")).rows[0]).toEqual({verification_status:"under_review"});
  });
  it("approves atomically and retains a unique attributed immutable decision",async()=>{
    const user=await profile();const {id}=await submit(user);await review(id);
    const r=await acting(db,user,"select verification_status,professional_id from public.professional_profiles");
    expect(r.rows[0]).toMatchObject({verification_status:"approved",professional_id:expect.stringMatching(/^PRO-/)});
    expect((await acting(db,user,`select reviewer_id,decision from public.verification_decisions where request_id='${id}'`)).rows).toEqual([{reviewer_id:reviewer,decision:"approved"}]);
    await expect(review(id)).rejects.toThrow("Application is no longer pending");
    await expect(db.exec(`update public.verification_decisions set reason='Changed reason' where request_id='${id}'`)).rejects.toThrow("Append-only record");
  });
  it("supports rejection and a fresh resubmission while preserving history",async()=>{
    const user=await profile();const first=await submit(user);await review(first.id,"rejected",false,false);
    expect((await acting(db,user,"select verification_status from public.professional_profiles")).rows[0]).toEqual({verification_status:"rejected"});
    const second=await submit(user);
    expect(first.id).not.toBe(second.id);
    expect((await acting(db,user,"select id from public.verification_requests")).rows).toHaveLength(2);
  });
  it("supports requesting more evidence without silently approving",async()=>{
    const user=await profile();const {id}=await submit(user);await review(id,"needs_more_evidence",false,false);
    expect((await acting(db,user,"select verification_status,professional_id from public.professional_profiles")).rows[0]).toEqual({verification_status:"unverified",professional_id:null});
  });
  it("separates reviewers from clinical read permissions",async()=>{
    expect((await acting(db,reviewer,"select id from public.children")).rows).toEqual([]);
    await expect(acting(db,reviewer,"select id from public.audit_events")).rejects.toThrow(/permission denied/);
  });
  it("restricts private document reads and protects submitted originals",async()=>{
    const user=await profile();const stranger=await profile();const {id,path}=await submit(user);
    expect((await acting(db,stranger,`select id from storage.objects where name='${path}'`)).rows).toEqual([]);
    expect((await acting(db,ordinaryAdmin,`select id from storage.objects where name='${path}'`)).rows).toEqual([]);
    expect((await acting(db,reviewer,`select id from storage.objects where name='${path}'`)).rows).toHaveLength(1);
    expect((await acting(db,user,`delete from storage.objects where name='${path}' returning id`)).rows).toEqual([]);
    expect((await acting(db,user,`update storage.objects set name='replacement' where name='${path}' returning id`)).rows).toEqual([]);
    await acting(db,reviewer,`select public.record_evidence_access('${id}')`);
    expect((await db.query("select actor_id from public.audit_events where entity_type='verification_evidence_access' and entity_id=$1",[id])).rows).toEqual([{actor_id:reviewer}]);
  });
  it("allows only owner cleanup of unsubmitted documents",async()=>{
    const user=await profile();const stranger=await profile();const path=await evidence(user,randomUUID());
    expect((await acting(db,stranger,`delete from storage.objects where name='${path}' returning id`)).rows).toEqual([]);
    expect((await acting(db,user,`delete from storage.objects where name='${path}' returning id`)).rows).toHaveLength(1);
  });
  it("audits suspension/reactivation and disallows treating unverified users as approved",async()=>{
    const user=await profile();const {id}=await submit(user);await review(id);
    await acting(db,reviewer,`select public.set_professional_suspension('${user}',true,'Suspension de test documentée.')`);
    expect((await acting(db,user,"select verification_status from public.professional_profiles")).rows[0]).toEqual({verification_status:"suspended"});
    await expect(submit(user)).rejects.toThrow("Submission not permitted");
    await acting(db,reviewer,`select public.set_professional_suspension('${user}',false,'Réactivation de test documentée.')`);
    expect((await acting(db,user,"select new_status from public.professional_status_events order by created_at")).rows).toHaveLength(3);
    const unverified=await profile();await expect(acting(db,reviewer,`select public.set_professional_suspension('${unverified}',false,'Tentative de réactivation invalide.')`)).rejects.toThrow("Approved professional required");
  });
  it("revokes reviewer access immediately after explicit permission removal",async()=>{
    await db.query("update private.staff_permissions set can_review_professionals=false where user_id=$1",[reviewer]);
    expect((await acting(db,reviewer,"select public.can_review_professionals() as allowed")).rows).toEqual([{allowed:false}]);
    await db.query("update private.staff_permissions set can_review_professionals=true where user_id=$1",[reviewer]);
  });
  it("never grants anonymous RPC execution",async()=>{
    await db.exec("set role anon");try { await expect(db.query("select public.can_review_professionals()")).rejects.toThrow(/permission denied/); } finally { await db.exec("reset role"); }
  });
});
describe("submission file validation",()=>{
  it("checks actual file signatures as well as MIME",()=>{
    expect(evidenceExtension("application/pdf",new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(evidenceExtension("application/pdf",new TextEncoder().encode("<script>"))).toBeNull();
    expect(evidenceExtension("image/png",new Uint8Array([137,80,78,71,13,10,26,10]))).toBe("png");
    expect(evidenceExtension("image/jpeg",new Uint8Array([255,216,255]))).toBe("jpg");
    expect(evidenceExtension("text/html",new TextEncoder().encode("%PDF-"))).toBeNull();
  });
  it("validates bounded identity fields and normalizes registration",()=>{
    expect(normalizeRegistration("  ab 123 /4 ")).toBe("AB123/4");
    expect(validateApplication("Dr Test","ab 123","Centre Test")).toBeNull();
    expect(validateApplication("x","ab 123","Centre Test")).toBeTruthy();
    expect(validateApplication("Dr Test","<script>","Centre Test")).toBeTruthy();
  });
});
