import { beforeAll, afterAll, it, expect, describe } from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { registrationUpdatesDatabase, sessionActing } from "./helpers/database";
let db: PGlite;
type Actor = { id: string; session: string; facility: string };
async function rpc<T = unknown>(
  a: Actor,
  name: string,
  args: unknown[] = [],
): Promise<T> {
  const result = await sessionActing(
    db,
    a.id,
    a.session,
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
    args,
  );
  return (result.rows[0] as { value: T }).value;
}
async function actor(role = "doctor", status = "approved"): Promise<Actor> {
  const a = { id: randomUUID(), session: randomUUID(), facility: "" };
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [a.id, `duplicate-${a.id}@example.invalid`],
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    a.session,
    a.id,
  ]);
  await db.query(
    "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,$3,$4)",
    [a.id, role, status, status === "approved" ? `DUP-${a.id}` : null],
  );
  if (role === "doctor" && status === "approved")
    a.facility = await rpc<string>(a, "create_facility", [
      randomUUID(),
      "Centre fictif de doublons",
      "",
    ]);
  return a;
}
function payload(
  a: Actor,
  family: string = randomUUID(),
): Record<string, unknown> {
  return {
    facility_id: a.facility,
    register_year: 2026,
    register_book: "A",
    local_number: "00125",
    given_name: "Amine",
    family_name: family,
    birth_date: "2025-01-01",
    birth_date_precision: "exact",
    sex: "male",
    smi_reference: "SMI non unique",
  };
}
async function prepare(
  a: Actor,
  op: string,
  body: Record<string, unknown>,
  mother: string | null = null,
  place: string | null = null,
  review = false,
) {
  return rpc<{ state: string; operation_id: string }>(
    a,
    "prepare_child_registration",
    [op, body, mother, place, review],
  );
}
async function create(
  a: Actor,
  body: Record<string, unknown>,
  mother = "Mère entièrement fictive",
  place = "Maternité entièrement fictive",
) {
  const op = randomUUID();
  expect((await prepare(a, op, body, mother, place)).state).toBe("ready");
  return rpc<string>(a, "register_child", [op, body]);
}
beforeAll(async () => {
  db = await registrationUpdatesDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("registration-bound private duplicate workflow", () => {
  it("asks for secondary fields across doctors and returns no existing record or access even when both match", async () => {
    const a = await actor(),
      b = await actor(),
      body = payload(a),
      id = await create(a, body),
      proposed = { ...body, facility_id: b.facility },
      op = randomUUID();
    await expect(
      rpc(b, "register_child", [op, proposed]),
    ).rejects.toMatchObject({ code: "42501" });
    const warning = await prepare(b, op, proposed);
    expect(warning.state).toBe("needs_details");
    expect(Object.keys(warning).sort()).toEqual([
      "checked",
      "operation_id",
      "state",
    ]);
    expect(JSON.stringify(warning)).not.toContain(id);
    expect(JSON.stringify(warning)).not.toContain(a.id);
    expect(
      (
        await prepare(
          b,
          op,
          proposed,
          "Mère entièrement fictive",
          "Maternité entièrement fictive",
        )
      ).state,
    ).toBe("need_qr");
    await expect(
      rpc(b, "register_child", [op, proposed]),
    ).rejects.toMatchObject({ code: "PT409" });
    await expect(rpc(b, "get_child_profile", [id])).rejects.toMatchObject({
      code: "42501",
    });
    expect(
      (
        await db.query("select id from public.children where created_by=$1", [
          b.id,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(
      sessionActing(
        db,
        b.id,
        b.session,
        "select private.registration_candidates($1,null,null)",
        [proposed],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("permits a distinct no-match registration, retains nonunique SMI and makes commit retries idempotent", async () => {
    const a = await actor(),
      b = await actor(),
      body = payload(a),
      first = await create(a, body),
      proposed = { ...body, facility_id: b.facility },
      op = randomUUID();
    expect((await prepare(b, op, proposed)).state).toBe("needs_details");
    expect(
      (
        await prepare(
          b,
          op,
          proposed,
          "Autre mère fictive",
          "Autre maternité fictive",
        )
      ).state,
    ).toBe("ready");
    const second = await rpc<string>(b, "register_child", [op, proposed]);
    expect(second).not.toBe(first);
    expect(await rpc(b, "register_child", [op, proposed])).toBe(second);
    expect(
      (
        await db.query(
          "select smi_reference from public.doctor_patient_registry where child_id in($1,$2)",
          [first, second],
        )
      ).rows,
    ).toEqual([
      { smi_reference: "SMI non unique" },
      { smi_reference: "SMI non unique" },
    ]);
  });
  it("holds uncertainty for independent scoped review, never merges or grants candidate access", async () => {
    const a = await actor(),
      b = await actor(),
      unrelated = await actor(),
      admin = await actor("admin"),
      body = payload(a),
      first = await create(a, body),
      proposed = { ...body, facility_id: b.facility },
      op = randomUUID();
    await prepare(b, op, proposed);
    expect(
      (
        await prepare(
          b,
          op,
          proposed,
          "Mère entièrement fictive",
          "Lieu incertain différent",
        )
      ).state,
    ).toBe("needs_review");
    const queue = await rpc<{
      items: { revision: number; operation_id: string }[];
    }>(a, "registration_review_queue");
    const item = queue.items.find((i) => i.operation_id === op)!;
    expect(item).toBeDefined();
    const args = [
      b.id,
      op,
      item.revision,
      "distinct",
      "Preuve entièrement fictive relue",
      "Identités distinctes établies pour ce test fictif.",
      true,
    ];
    for (const who of [b, unrelated, admin])
      await expect(
        rpc(who, "review_child_registration", args),
      ).rejects.toMatchObject({ code: "42501" });
    await rpc(a, "review_child_registration", args);
    await expect(
      rpc(a, "review_child_registration", args),
    ).rejects.toMatchObject({ code: "PT409" });
    const own = await rpc<{ items: { state: string }[] }>(
      b,
      "my_registration_cases",
      [op],
    );
    expect(own.items[0].state).toBe("ready");
    const second = await rpc<string>(b, "finish_child_registration", [op]);
    expect(second).not.toBe(first);
    await expect(rpc(b, "get_child_profile", [first])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      db.query(
        "delete from private.registration_reviews where operation_id=$1",
        [op],
      ),
    ).rejects.toThrow(/Append-only/);
  });
  it("blocks competing clear cases at commit and binds each case to its original registration context", async () => {
    const a = await actor(),
      b = await actor(),
      body = payload(a),
      proposed = { ...body, facility_id: b.facility },
      opA = randomUUID(),
      opB = randomUUID();
    expect((await prepare(a, opA, body)).state).toBe("ready");
    expect((await prepare(b, opB, proposed)).state).toBe("ready");
    await rpc(a, "register_child", [opA, body]);
    await expect(
      rpc(b, "register_child", [opB, proposed]),
    ).rejects.toMatchObject({ code: "PT409" });
    await expect(
      prepare(b, opB, { ...proposed, given_name: "Autre identité" }),
    ).rejects.toMatchObject({ code: "22023" });
    expect((await prepare(b, opB, proposed)).state).toBe("needs_details");
    expect(
      (await rpc<{ items: unknown[] }>(a, "my_registration_cases", [opB]))
        .items,
    ).toEqual([]);
  });
  it("rate limits real registration probes including review requests and keeps logs append-only without names", async () => {
    const a = await actor();
    for (let i = 0; i < 10; i++)
      expect(
        (
          await prepare(
            a,
            randomUUID(),
            payload(a, `Fictif-${i}`),
            null,
            null,
            true,
          )
        ).state,
      ).toBe("ready");
    expect((await prepare(a, randomUUID(), payload(a, "Limite"))).state).toBe(
      "rate_limited",
    );
    const events = await db.query<{ outcome: string }>(
      "select outcome from private.registration_probe_events where actor_id=$1",
      [a.id],
    );
    expect(
      events.rows.filter((e) => e.outcome === "rate_limited"),
    ).toHaveLength(1);
    await expect(
      db.query(
        "delete from private.registration_probe_events where actor_id=$1",
        [a.id],
      ),
    ).rejects.toThrow(/Append-only/);
  });
  it("does not infer across anonymous/unverified/banned users and preserves explicit unknown identity", async () => {
    const a = await actor(),
      unverified = await actor("doctor", "unverified");
    await expect(
      prepare(unverified, randomUUID(), payload(a)),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query(
      "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
      [a.id],
    );
    await expect(prepare(a, randomUUID(), payload(a))).rejects.toMatchObject({
      code: "42501",
    });
    await db.query("update auth.users set banned_until=null where id=$1", [
      a.id,
    ]);
    const body = {
      ...payload(a),
      given_name: "",
      family_name: "",
      name_status: "unknown",
      birth_date: "",
      birth_date_precision: "unknown",
      sex: "unknown",
    };
    const op = randomUUID();
    expect(await prepare(a, op, body)).toMatchObject({
      state: "ready",
      checked: false,
    });
    const id = await rpc<string>(a, "register_child", [op, body]);
    expect(
      (
        await db.query(
          "select given_name,birth_date from public.children where id=$1",
          [id],
        )
      ).rows,
    ).toEqual([{ given_name: null, birth_date: null }]);
  });
});
