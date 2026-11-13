export async function onRequestError() {
  const { reportOperationalEvent } = await import("@/lib/operational-events");
  reportOperationalEvent("server_request_failed");
}
