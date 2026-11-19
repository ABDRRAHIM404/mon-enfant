"use client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "@/components/qr/code";
import { issueParentShare, revokeParentShare } from "@/app/share/actions";
import {
  shareLabels,
  type ShareList,
  type ShareReceipt,
} from "@/lib/sharing/types";
export function ParentSharePanel({
  childId,
  list,
}: {
  childId: string;
  list: ShareList;
}) {
  const router = useRouter();
  const [issued, setIssued] = useState<
      (ShareReceipt & { url?: string; offset: number }) | null
    >(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [seconds, setSeconds] = useState(0);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!issued) return;
    const timer = setInterval(() => {
      if (Date.now() + issued.offset >= Date.parse(issued.expires_at)) {
        setIssued(null);
        setMessage("Le code a expiré. Vous pouvez en créer un nouveau.");
        router.refresh();
      } else
        setSeconds(
          Math.max(
            0,
            Math.ceil(
              (Date.parse(issued.expires_at) - Date.now() - issued.offset) /
                1000,
            ),
          ),
        );
    }, 1000);
    return () => clearInterval(timer);
  }, [issued, router]);
  function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await issueParentShare(form);
        if (result.share) {
          setSeconds(
            Math.max(
              0,
              Math.ceil(
                (Date.parse(result.share.expires_at) -
                  Date.parse(result.share.server_now)) /
                  1000,
              ),
            ),
          );
          setIssued({
            ...result.share,
            offset: Date.parse(result.share.server_now) - Date.now(),
          });
        } else setError(result.error ?? "Partage indisponible.");
        router.refresh();
      } catch {
        setError(
          "La demande n’a pas pu aboutir. Actualisez la page avant de réessayer.",
        );
      }
    });
  }
  function revoke(id: string) {
    setError("");
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("shareId", id);
        const result = await revokeParentShare(form);
        if (result.error) setError(result.error);
        else {
          if (issued?.id === id) setIssued(null);
          setMessage(
            "Partage révoqué. Ce code et son accès temporaire ne sont plus utilisables.",
          );
          router.refresh();
        }
      } catch {
        setError("Révocation non confirmée. Actualisez la page et réessayez.");
      }
    });
  }
  return (
    <section
      className="workspace-surface share-panel"
      aria-labelledby="parent-share-heading"
    >
      <h2 id="parent-share-heading">Partager le carnet</h2>
      <p className="muted">
        Un code temporaire autorise un soignant vérifié à lire les informations
        que vous choisissez, sans les modifier.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {issued?.url ? (
        <div className="share-secret">
          <p>
            <strong>{shareLabels[issued.scope]}</strong>
          </p>
          <p role="timer" aria-label="Durée restante du code">
            Expire dans {Math.floor(seconds / 60)} min {seconds % 60} s
          </p>
          <QrCode
            value={issued.url}
            label="Partage temporaire — montrer uniquement au soignant choisi"
          />
          <label htmlFor="temporary-share-url">Lien personnel temporaire</label>
          <input
            id="temporary-share-url"
            readOnly
            value={issued.url}
            autoComplete="off"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(issued.url!)
                .then(() =>
                  setMessage(
                    "Lien copié. Transmettez-le uniquement au soignant choisi.",
                  ),
                )
                .catch(() =>
                  setError(
                    "Copie indisponible. Sélectionnez le lien pour le copier.",
                  ),
                );
            }}
          >
            Copier le lien temporaire
          </button>
          <button
            className="button secondary"
            disabled={pending}
            type="button"
            onClick={() => revoke(issued.id)}
          >
            Révoquer ce code
          </button>
        </div>
      ) : (
        <form onSubmit={issue} className="auth-form" aria-busy={pending}>
          <input type="hidden" name="childId" value={childId} />
          <label htmlFor="share-scope">Informations à partager</label>
          <select
            id="share-scope"
            name="scope"
            defaultValue="vaccination_read"
            disabled={!list.can_share || pending}
          >
            <option value="vaccination_read">
              Vaccinations et références — suivi vaccinal
            </option>
            <option value="booklet_read">
              Carnet de santé — soins, croissance et rendez-vous
            </option>
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              name="consent"
              required
              disabled={!list.can_share || pending}
            />
            J’autorise un soignant vérifié à lire ces informations pendant cinq
            minutes maximum.
          </label>
          <button
            className="button primary"
            disabled={!list.can_share || pending}
          >
            {pending ? "Création…" : "Afficher mon QR sécurisé"}
          </button>
        </form>
      )}
      {!list.can_share && (
        <p className="notice">
          Votre accès permet la lecture du carnet, mais ne vous autorise pas à
          le transmettre. Contactez le professionnel responsable pour faire
          vérifier cette autorisation.
        </p>
      )}
      <p className="fine">
        Code à usage unique. Le premier soignant vérifié qui le présente obtient
        une lecture liée à sa session, jusqu’à l’échéance indiquée. Montrez-le
        en privé. Un nouveau code remplace l’ancien code inutilisé. Vous pouvez
        révoquer l’accès à tout moment.
      </p>
      {list.items.length > 0 && (
        <details className="share-status">
          <summary>Mes partages récents</summary>
          <ul>
            {list.items.map((item) => (
              <li key={item.id}>
                <strong>{shareLabels[item.scope]}</strong>
                <p>
                  {item.active
                    ? item.consumed_at
                      ? `Ouvert par ${item.professional_id}`
                      : "En attente du soignant"
                    : item.revoked_at
                      ? "Révoqué"
                      : "Terminé ou indisponible"}{" "}
                  · échéance{" "}
                  {new Date(item.expires_at).toLocaleTimeString("fr-MA", {
                    timeZone: "Africa/Casablanca",
                  })}
                </p>
                {item.active && (
                  <button
                    type="button"
                    className="text-link"
                    disabled={pending}
                    onClick={() => revoke(item.id)}
                  >
                    Révoquer ce partage
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
