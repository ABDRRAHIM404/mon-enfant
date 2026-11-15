// Ephemeral GitHub-runner TLS for production Secure-cookie acceptance.
// No request, cookie, provider response or credential logging.
import { createServer } from "node:https";
import { request } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  ![
    "forms-cloud-accept",
    "smart-forms-cloud-accept",
    "updates-cloud-accept",
    "design-cloud-accept",
    "sharing-cloud-accept",
  ].includes(process.env.MON_ENFANT_LIVE_PROBE)
)
  throw new Error("Explicit cloud-only update acceptance required");
const root = process.env.RUNNER_TEMP;
if (!root) throw new Error("Missing runner temporary directory");
createServer(
  {
    key: readFileSync(join(root, "updates-key.pem")),
    cert: readFileSync(join(root, "updates-cert.pem")),
  },
  (incoming, outgoing) => {
    const upstream = request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: incoming.url,
        method: incoming.method,
        headers: { ...incoming.headers, "x-forwarded-proto": "https" },
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      },
    );
    upstream.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end("Temporary cloud server unavailable");
    });
    incoming.on("error", () => upstream.destroy());
    incoming.pipe(upstream);
  },
).listen(3443);
