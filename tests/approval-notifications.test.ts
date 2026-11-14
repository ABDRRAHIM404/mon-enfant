import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { notificationDatabase } from "./helpers/database";
let db: PGlite;
type Actor = { id: string; session: string; email: string };
type Job = {
  id: string;
  lease_id: string;
  recipient_email: string;
  from_email: string;
  site_origin: string;
  template_version: number;
};
async function actor(
  kind: "doctor" | "reviewer" | "admin" | "worker",
  confirmed = true,
): Promise<Actor> {
  const id = randomUUID(),
    session = randomUUID(),
    email = `notification-${id}@example.invalid`;
  await db.query<Record<string, unknown>>(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)",
    [id, email, confirmed ? "2026-01-01T00:00:00Z" : null],
  );
  await db.query<Record<string, unknown>>(
    "insert into auth.sessions(id,user_id) values($1,$2)",
    [session, id],
  );
  if (kind === "worker")
    await db.query<Record<string, unknown>>(
      "insert into private.notification_workers(user_id,enabled) values($1,true)",
      [id],
    );
  else {
    await db.query<Record<string, unknown>>(
      "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,$3,$4)",
      [
        id,
        kind === "doctor" ? "doctor" : "admin",
        kind === "doctor" ? "unverified" : "approved",
        kind === "doctor" ? null : `MAIL-${id}`,
      ],
    );
    if (kind === "reviewer")
      await db.query<Record<string, unknown>>(
        "insert into private.staff_permissions(user_id,can_review_professionals) values($1,true)",
        [id],
      );
  }
  return { id, session, email };
}
async function as<T>(a: Actor, sql: string, args: unknown[] = []): Promise<T> {
  // Savepoints keep expected Postgres errors from aborting the isolated test.
  await db.exec("savepoint notification_rpc");
  try {
    await db.query<Record<string, unknown>>(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",
      [a.id, a.session],
    );
    await db.exec("set role authenticated");
    const result = await db.query<Record<string, unknown>>(sql, args);
    await db.exec("reset role; release savepoint notification_rpc");
    return result.rows[0] as T;
  } catch (error) {
    await db.exec(
      "rollback to savepoint notification_rpc; reset role; release savepoint notification_rpc",
    );
    throw error;
  }
}
async function rpc<T>(
  a: Actor,
  name: string,
  args: unknown[] = [],
): Promise<T> {
  return (
    await as<{ value: T }>(
      a,
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
      args,
    )
  ).value;
}
async function request(doctor: Actor) {
  const id = randomUUID(),
    path = `${doctor.id}/${id}/evidence.pdf`;
  await db.query<Record<string, unknown>>(
    "insert into storage.objects(bucket_id,name) values('professional-evidence',$1)",
    [path],
  );
  await rpc(doctor, "submit_verification", [
    id,
    "Professionnel entièrement fictif",
    `REG-${randomUUID()}`,
    "Centre fictif",
    path,
  ]);
  return id;
}
async function approve(reviewer: Actor, doctor: Actor) {
  const id = await request(doctor);
  await rpc(reviewer, "review_verification", [
    id,
    "approved",
    "Contrôles fictifs et source documentés.",
    true,
    true,
  ]);
  return id;
}
const claim = (
  worker: Actor,
  requestId: string | null = null,
  recipient: string | null = null,
  from = "onboarding@resend.dev",
  site = "https://mon-enfant.vercel.app",
  limit = 3,
) =>
  rpc<Job[]>(worker, "claim_approval_notifications", [
    from,
    site,
    limit,
    requestId,
    recipient,
  ]);
const finish = (
  worker: Actor,
  job: Job,
  result = "accepted",
  provider: string | null = randomUUID(),
) =>
  rpc(worker, "finish_approval_notification", [
    job.id,
    job.lease_id,
    result,
    provider,
  ]);
beforeAll(async () => {
  db = await notificationDatabase();
});
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});
afterAll(async () => {
  await db.close();
});

describe("transactional approval notifications and isolated sender authority", () => {
  it("queues exactly one notice with the committed approval and no rejected notice", async () => {
    const reviewer = await actor("reviewer"),
      doctor = await actor("doctor");
    const id = await approve(reviewer, doctor);
    const row = (
      await db.query<Record<string, unknown>>(
        "select id,state,recipient_id,attempts from private.approval_notifications where request_id=$1",
        [id],
      )
    ).rows[0];
    expect(row).toMatchObject({
      state: "pending",
      recipient_id: doctor.id,
      attempts: 0,
    });
    await expect(
      rpc(reviewer, "review_verification", [
        id,
        "approved",
        "Aucune double approbation fictive.",
        true,
        true,
      ]),
    ).rejects.toThrow(/no longer pending/);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select count(*)::integer n from private.approval_notifications",
        )
      ).rows[0].n,
    ).toBe(1);
    const other = await actor("doctor"),
      rejected = await request(other);
    await rpc(reviewer, "review_verification", [
      rejected,
      "rejected",
      "Rejet entièrement fictif documenté.",
      false,
      false,
    ]);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select count(*)::integer n from private.approval_notifications",
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("rolls back the queue with a failed approval transaction", async () => {
    const reviewer = await actor("reviewer"),
      doctor = await actor("doctor"),
      id = await request(doctor);
    await db.exec("savepoint approval_transaction");
    await rpc(reviewer, "review_verification", [
      id,
      "approved",
      "Décision fictive à annuler.",
      true,
      true,
    ]);
    await db.exec(
      "rollback to savepoint approval_transaction; release savepoint approval_transaction",
    );
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select count(*)::integer n from private.approval_notifications",
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select verification_status from public.professional_profiles where user_id=$1",
          [doctor.id],
        )
      ).rows[0].verification_status,
    ).toBe("under_review");
  });
  it("does not grant dispatch to ordinary admins, reviewers or approved doctors", async () => {
    const reviewer = await actor("reviewer"),
      doctor = await actor("doctor"),
      admin = await actor("admin");
    await approve(reviewer, doctor);
    for (const a of [reviewer, doctor, admin])
      await expect(claim(a)).rejects.toMatchObject({ code: "42501" });
    const worker = await actor("worker");
    await expect(
      as(worker, "select * from private.approval_notifications"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      rpc(worker, "get_child_profile", [randomUUID()]),
    ).rejects.toThrow(/access denied/i);
    const status = await rpc<Record<string, unknown>>(
      reviewer,
      "approval_notification_status",
      [
        (
          await db.query<Record<string, unknown>>(
            "select request_id from private.approval_notifications",
          )
        ).rows[0].request_id,
      ],
    );
    expect(Object.keys(status).sort()).toEqual([
      "accepted_at",
      "attempts",
      "state",
    ]);
    await expect(
      rpc(worker, "approval_notification_status", [randomUUID()]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("selects only confirmed, explicitly restricted recipients", async () => {
    const reviewer = await actor("reviewer"),
      worker = await actor("worker"),
      a = await actor("doctor"),
      b = await actor("doctor"),
      unconfirmed = await actor("doctor", false);
    await approve(reviewer, a);
    await approve(reviewer, b);
    await approve(reviewer, unconfirmed);
    const jobs = await claim(worker, null, a.email);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].recipient_email).toBe(a.email);
    const remaining = await claim(worker);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].recipient_email).toBe(b.email);
  });
  it("uses exclusive leases, stable payloads and explicit stale-lease PT409 conflicts", async () => {
    const reviewer = await actor("reviewer"),
      worker = await actor("worker"),
      doctor = await actor("doctor"),
      id = await approve(reviewer, doctor);
    const [first] = await claim(worker, id);
    expect(await claim(worker, id)).toEqual([]);
    await db.query<Record<string, unknown>>(
      "update private.approval_notifications set lease_until=now()-interval '1 second' where id=$1",
      [first.id],
    );
    const [second] = await claim(
      worker,
      id,
      null,
      "different@example.invalid",
      "https://different.example.invalid",
    );
    expect(second.id).toBe(first.id);
    expect(second.lease_id).not.toBe(first.lease_id);
    expect(second.from_email).toBe(first.from_email);
    expect(second.site_origin).toBe(first.site_origin);
    expect(second.recipient_email).toBe(first.recipient_email);
    await expect(finish(worker, first)).rejects.toMatchObject({
      code: "PT409",
    });
    await finish(worker, second);
    expect(await claim(worker, id)).toEqual([]);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select attempts,state from private.approval_notifications where id=$1",
          [first.id],
        )
      ).rows[0],
    ).toEqual({ attempts: 2, state: "accepted" });
  });
  it("retains approval on transport failure and stops uncertain retries before provider key expiry", async () => {
    const reviewer = await actor("reviewer"),
      worker = await actor("worker"),
      doctor = await actor("doctor"),
      id = await approve(reviewer, doctor);
    const [job] = await claim(worker, id);
    await finish(worker, job, "retry", null);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select verification_status from public.professional_profiles where user_id=$1",
          [doctor.id],
        )
      ).rows[0].verification_status,
    ).toBe("approved");
    expect(await claim(worker, id)).toEqual([]);
    await db.query<Record<string, unknown>>(
      "update private.approval_notifications set first_attempt_at=now()-interval '21 hours',next_attempt_at=now()-interval '1 minute' where id=$1",
      [job.id],
    );
    expect(await claim(worker, id)).toEqual([]);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select state from private.approval_notifications where id=$1",
          [job.id],
        )
      ).rows[0].state,
    ).toBe("needs_review");
  });
  it("honors suspension, changed addresses and worker revocation immediately", async () => {
    const reviewer = await actor("reviewer"),
      worker = await actor("worker"),
      doctor = await actor("doctor"),
      id = await approve(reviewer, doctor);
    const [job] = await claim(worker, id);
    await finish(worker, job, "retry", null);
    await db.query<Record<string, unknown>>(
      "update private.approval_notifications set next_attempt_at=now()-interval '1 minute' where id=$1",
      [job.id],
    );
    await db.query<Record<string, unknown>>(
      "update auth.users set email='changed@example.invalid' where id=$1",
      [doctor.id],
    );
    expect(await claim(worker, id)).toEqual([]);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select state from private.approval_notifications where id=$1",
          [job.id],
        )
      ).rows[0].state,
    ).toBe("cancelled");
    const other = await actor("doctor"),
      otherId = await approve(reviewer, other);
    await rpc(reviewer, "set_professional_suspension", [
      other.id,
      true,
      "Suspension entièrement fictive documentée.",
    ]);
    expect(await claim(worker, otherId)).toEqual([]);
    await db.query<Record<string, unknown>>(
      "update private.notification_workers set enabled=false where user_id=$1",
      [worker.id],
    );
    await expect(claim(worker)).rejects.toMatchObject({ code: "42501" });
  });
  it("rejects banned or stale worker sessions and cannot self-appoint a sender", async () => {
    const worker = await actor("worker"),
      admin = await actor("admin");
    await expect(
      as(
        admin,
        "insert into private.notification_workers(user_id,enabled) values($1,true)",
        [admin.id],
      ),
    ).rejects.toThrow(/permission denied/);
    await db.query<Record<string, unknown>>(
      "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
      [worker.id],
    );
    await expect(claim(worker)).rejects.toMatchObject({ code: "42501" });
    await db.query<Record<string, unknown>>(
      "update auth.users set banned_until=null where id=$1",
      [worker.id],
    );
    await db.query<Record<string, unknown>>(
      "delete from auth.sessions where id=$1",
      [worker.session],
    );
    await expect(claim(worker)).rejects.toMatchObject({ code: "42501" });
  });
  it("caps claims at ten per hour without granting a wider batch", async () => {
    const reviewer = await actor("reviewer"),
      worker = await actor("worker");
    for (let i = 0; i < 11; i++) await approve(reviewer, await actor("doctor"));
    const sizes = [];
    for (let i = 0; i < 5; i++) sizes.push((await claim(worker)).length);
    expect(sizes).toEqual([3, 3, 3, 1, 0]);
    await expect(
      claim(worker, null, null, undefined, undefined, 4),
    ).rejects.toMatchObject({ code: "22023" });
  });
  it("retains append-only dispatch events", async () => {
    const reviewer = await actor("reviewer"),
      doctor = await actor("doctor");
    await approve(reviewer, doctor);
    await expect(
      db.query<Record<string, unknown>>(
        "delete from private.notification_events",
      ),
    ).rejects.toThrow(/Append-only/);
  });
});
