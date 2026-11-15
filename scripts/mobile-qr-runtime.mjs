// Only the runner sees the active QR image, decoded token and synthetic session.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import jsQR from "jsqr";
if (process.env.GITHUB_ACTIONS !== "true")
  throw new Error("Cloud runtime only");
const run = process.env.MON_ENFANT_QA_RUN;
if (!/^[a-f0-9]{16}$/.test(run || "")) throw new Error("Missing fixture");
const base = "https://zkkasbxvdvecnafgjpxd.supabase.co";
const key = process.env.MON_ENFANT_PARENT_BROWSER_PUBLIC_KEY;
const email = process.env.MON_ENFANT_PARENT_BROWSER_OUTSIDE_EMAIL;
const password = process.env.MON_ENFANT_PARENT_BROWSER_OUTSIDE_PASSWORD;
if (email !== `qa-parent-${run}-outside@example.invalid` || !key || !password)
  throw new Error("Missing synthetic recipient");
const stateFile = path.join(process.env.RUNNER_TEMP, "native-qr-receiver.json");
async function request(endpoint, body, token) {
  const response = await fetch(base + endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const value = response.status === 204 ? null : await response.json();
  return { status: response.status, value };
}
try {
  if (process.argv[2] === "redeem") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const { data, info } = await sharp(Buffer.concat(chunks))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
    )?.data;
    if (
      !/^https:\/\/mon-enfant\.vercel\.app\/share#share=[A-Za-z0-9_-]{43}$/.test(
        decoded || "",
      )
    )
      throw new Error("Invalid native QR");
    const login = await request("/auth/v1/token?grant_type=password", {
      email,
      password,
    });
    if (login.status !== 200)
      throw new Error("Synthetic recipient login failed");
    const token = login.value.access_token;
    const redeemed = await request(
      "/rest/v1/rpc/redeem_clinician_share",
      { p_token: decoded.split("#share=")[1] },
      token,
    );
    if (redeemed.status !== 200 || !redeemed.value.accepted)
      throw new Error("Native QR not redeemable");
    const id = redeemed.value.id;
    const read = await request(
      "/rest/v1/rpc/read_clinician_share",
      { p_share_id: id, p_page: 1 },
      token,
    );
    if (
      read.status !== 200 ||
      read.value.scope !== "vaccination_read" ||
      read.value.data.history.total !== 1 ||
      "appointments" in read.value.data
    )
      throw new Error("Unexpected native QR scope");
    const denied = await request(
      "/rest/v1/rpc/get_child_profile",
      { p_child_id: read.value.data.history.child.id },
      token,
    );
    if (denied.status !== 403 || denied.value.code !== "42501")
      throw new Error("Native QR silently granted child access");
    await fs.writeFile(stateFile, JSON.stringify({ token, id }), {
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        native_qr_independently_decoded: true,
        recipient_redemption: true,
        scoped_read: true,
      }),
    );
  } else if (process.argv[2] === "revoked") {
    const { token, id } = JSON.parse(await fs.readFile(stateFile, "utf8"));
    const read = await request(
      "/rest/v1/rpc/read_clinician_share",
      { p_share_id: id, p_page: 1 },
      token,
    );
    if (read.status !== 403 || read.value.code !== "42501")
      throw new Error("Native revocation not enforced");
    await request("/auth/v1/logout?scope=local", {}, token);
    await fs.unlink(stateFile);
    console.log(
      JSON.stringify({
        native_revocation_denied_existing_recipient_session: true,
      }),
    );
  } else throw new Error("Invalid operation");
} catch {
  console.log(JSON.stringify({ passed: false, details_withheld: true }));
  process.exitCode = 1;
}
