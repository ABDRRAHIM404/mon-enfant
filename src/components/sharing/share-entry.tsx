"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleAlert,
  ExternalLink,
  Info,
  Link2,
  QrCode,
} from "lucide-react";
import { ShareScanner } from "./scan-input";
import { shareToken } from "@/lib/sharing/types";
import { redeemShare } from "@/app/share/actions";

export function ShareEntry({ verified }: { verified: boolean }) {
  const tokenInput = useRef<HTMLInputElement>(null);
  const opening = useRef(false);
  const detected = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [opened, setOpened] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!window.location.hash) return;
    const token = shareToken(window.location.href, window.location.origin);
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    if (token && tokenInput.current) tokenInput.current.value = token;
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (opening.current) return;
    const raw = String(new FormData(event.currentTarget).get("token") ?? "");
    const token = shareToken(raw, window.location.origin);
    if (!token) {
      setError("Saisissez un code ou un lien de partage Mon Enfant valide.");
      tokenInput.current?.focus();
      return;
    }
    const form = new FormData();
    form.set("token", token);
    setError("");
    setNeedsLogin(false);
    opening.current = true;
    startTransition(async () => {
      let navigating = false;
      try {
        const result = await redeemShare(form);
        const href = result.draftId
          ? `/patients/new?draft=${result.draftId}`
          : result.childId
            ? `/patients/${result.childId}`
            : result.share
              ? `/share/view/${result.share.id}`
              : null;
        if (href) {
          if (tokenInput.current) tokenInput.current.value = "";
          router.replace(href);
          navigating = true;
          setOpened(true);
        } else {
          setError(result.error ?? "Partage indisponible.");
          setNeedsLogin(!!result.needsLogin);
        }
      } catch {
        setError(
          "L’ouverture n’a pas pu aboutir. Vérifiez votre connexion et demandez un nouveau code si nécessaire.",
        );
      } finally {
        if (!navigating) opening.current = false;
      }
    });
  }

  return (
    <div className="qr-reader-grid">
      <ShareScanner
        disabled={pending || opened}
        onScanStart={() => {
          if (
            detected.current &&
            tokenInput.current?.value === detected.current
          )
            tokenInput.current.value = "";
          detected.current = null;
        }}
        onToken={(token) => {
          if (opening.current) return;
          detected.current = token;
          if (tokenInput.current) tokenInput.current.value = token;
          setError("");
          setNeedsLogin(false);
        }}
      />
      <section
        className="qr-reader-card qr-reader-manual"
        aria-labelledby="share-code-heading"
      >
        <h2 id="share-code-heading">
          <Link2 aria-hidden="true" /> Code ou lien temporaire
        </h2>
        <form onSubmit={submit} aria-busy={pending}>
          <label className="sr-only" htmlFor="share-code">
            Code ou lien temporaire
          </label>
          <input
            ref={tokenInput}
            id="share-code"
            name="token"
            type="password"
            placeholder="Saisir le code ou coller le lien…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={512}
            required
            readOnly={pending || opened}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "share-code-error" : undefined}
          />
          {error && (
            <p
              id="share-code-error"
              className="qr-reader-feedback"
              data-failure="true"
              role="alert"
            >
              <CircleAlert size={17} aria-hidden="true" /> {error}
            </p>
          )}
          <button
            className="qr-reader-button qr-reader-primary"
            disabled={pending || opened}
          >
            <ExternalLink size={20} aria-hidden="true" />{" "}
            {pending
              ? "Vérification du partage…"
              : opened
                ? "Partage autorisé"
                : "Ouvrir le partage"}
          </button>
          {opened && (
            <p className="qr-reader-feedback" role="status">
              Partage autorisé. Ouverture en cours.
            </p>
          )}
        </form>
        {(!verified || needsLogin) && (
          <div className="qr-reader-login">
            <Link
              href="/login?audience=clinician"
              target="_blank"
              rel="noopener noreferrer"
            >
              Se connecter comme soignant dans un autre onglet
            </Link>
            {needsLogin && (
              <p className="qr-reader-small">
                Revenez ici après la connexion, puis cliquez sur « Ouvrir le
                partage ».
              </p>
            )}
          </div>
        )}
      </section>
      <p className="qr-reader-info">
        <Info size={21} aria-hidden="true" />
        <span>
          Le code est à usage unique et expire après 5 minutes. Le partage
          s’ouvre avec un compte soignant vérifié, selon vos habilitations.
        </span>
      </p>
      <section
        className="qr-reader-card qr-reader-guide"
        aria-labelledby="qr-guide-title"
      >
        <h2 id="qr-guide-title">
          <QrCode aria-hidden="true" /> À quoi sert ce QR ?
        </h2>
        <ul>
          <li>
            <Check aria-hidden="true" /> Consulter la partie du carnet choisie
            par le parent.
          </li>
          <li>
            <Check aria-hidden="true" /> Documenter une visite si le parent l’a
            autorisée et si vos habilitations le permettent.
          </li>
          <li>
            <Check aria-hidden="true" /> Préremplir une nouvelle inscription
            avec le QR de fiche parent.
          </li>
        </ul>
        <p className="qr-reader-small">
          La visite et la fiche parent nécessitent un compte médecin vérifié.
        </p>
        <Image
          className="qr-guide-illustration"
          src="/dashboard-art/shared-qr-guide.webp"
          width={425}
          height={390}
          unoptimized
          alt=""
        />
      </section>
    </div>
  );
}
