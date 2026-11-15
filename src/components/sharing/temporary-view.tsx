"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function TemporaryView({
  expiresAt,
  serverNow,
  children,
}: {
  expiresAt: string;
  serverNow: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(() =>
    Math.max(
      0,
      Math.ceil((Date.parse(expiresAt) - Date.parse(serverNow)) / 1000),
    ),
  );
  useEffect(() => {
    const start = Date.now(),
      duration = Date.parse(expiresAt) - Date.parse(serverNow);
    const tick = setInterval(
      () =>
        setRemaining(
          Math.max(0, Math.ceil((duration - (Date.now() - start)) / 1000)),
        ),
      1000,
    );
    const refresh = setInterval(() => router.refresh(), 10000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [expiresAt, serverNow, router]);
  if (remaining <= 0)
    return (
      <section className="notice">
        <h2>Partage expiré</h2>
        <p>
          Demandez un nouveau code au responsable si une nouvelle lecture est
          nécessaire.
        </p>
      </section>
    );
  return (
    <>
      <div className="notice">
        <p role="timer" aria-label="Durée restante du partage">
          Lecture temporaire · {Math.floor(remaining / 60)} min {remaining % 60}{" "}
          s restantes
        </p>
        <button
          type="button"
          className="button secondary"
          onClick={() => router.refresh()}
        >
          Vérifier et actualiser
        </button>
      </div>
      {children}
    </>
  );
}
