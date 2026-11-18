"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
export function LiveRefresh() {
  const router = useRouter(),
    [pending, startTransition] = useTransition();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        Date.now() - last < 60000 ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          document.activeElement?.tagName ?? "",
        )
      )
        return;
      last = Date.now();
      router.refresh();
    };
    const interval = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return (
    <div className="dashboard-refresh" aria-busy={pending}>
      <button
        className="button secondary"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw size={15} aria-hidden="true" />
        {pending ? "Actualisation…" : "Actualiser les suivis"}
      </button>
      <span className="fine">Mise à jour automatique</span>
    </div>
  );
}
