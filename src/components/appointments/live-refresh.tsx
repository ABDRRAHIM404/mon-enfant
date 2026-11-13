"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <div className="tabs">
      <button
        className="button secondary"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Actualisation…" : "Actualiser les suivis"}
      </button>
      <span className="fine">
        Actualisation automatique chaque minute quand cette page est visible.
      </span>
    </div>
  );
}
