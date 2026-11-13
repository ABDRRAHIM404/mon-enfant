import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";

// Never log browser error messages, DOM diffs, cookies or clinical payloads.
export function observeBrowserErrors(
  page: Page,
  role: string,
  increment: () => void,
) {
  page.on("pageerror", (error) => {
    increment();
    const route = new URL(page.url()).pathname.replace(
      /[a-f0-9-]{36}/gi,
      ":id",
    );
    const known =
      error.message.match(
        /Minified React error #\d+|NEXT_[A-Z_]+|Hydration failed|Failed to fetch|Load failed/g,
      ) ?? [];
    const sources =
      error.stack?.match(/\/_next\/static\/[a-zA-Z0-9/._-]+\.js:\d+:\d+/g) ??
      [];
    console.log(
      JSON.stringify({
        event: "browser_error",
        role,
        route,
        known_codes: [...new Set(known)],
        source_locations: [...new Set(sources)].slice(0, 4),
        message_sha256: createHash("sha256")
          .update(error.message)
          .digest("hex"),
      }),
    );
  });
}
