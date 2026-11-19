"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShareScanner } from "./scan-input";
import { scanShareCode } from "@/lib/sharing/types";
import { redeemShare } from "@/app/share/actions";
export function ShareEntry() {
  const tokenInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(""),
    [needsLogin, setNeedsLogin] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const token = scanShareCode(window.location.href, window.location.origin);
    window.history.replaceState(null, "", window.location.pathname);
    if (token && tokenInput.current) tokenInput.current.value = token;
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("token") ?? "");
    const token = scanShareCode(raw, window.location.origin);
    if (!token) {
      setError("Présentez un code ou un lien de partage temporaire valide.");
      return;
    }
    const form = new FormData();
    form.set("token", token);
    setError("");
    startTransition(async () => {
      try {
        const result = await redeemShare(form);
        if (result.childId) {
          if (tokenInput.current) tokenInput.current.value = "";
          router.replace(`/patients/${result.childId}`);
        } else if (result.share) {
          if (tokenInput.current) tokenInput.current.value = "";
          router.replace(`/share/view/${result.share.id}`);
        } else {
          setError(result.error ?? "Partage indisponible.");
          setNeedsLogin(!!result.needsLogin);
        }
      } catch {
        setError(
          "L’ouverture n’a pas pu aboutir. Vérifiez votre connexion et demandez un nouveau code si nécessaire.",
        );
      }
    });
  }
  return (
    <>
      <ShareScanner
        onToken={(token) => {
          if (tokenInput.current) tokenInput.current.value = token;
          setError("");
        }}
      />
      <form onSubmit={submit} className="auth-form" aria-busy={pending}>
        <label htmlFor="share-code">Code ou lien temporaire</label>
        <input
          ref={tokenInput}
          id="share-code"
          name="token"
          type="password"
          autoComplete="off"
          maxLength={512}
          required
        />
        <p className="fine">
          Chaque code est à usage unique. Une invitation de soins doit être
          ouverte avec le compte du médecin destinataire.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="button primary" disabled={pending}>
          {pending ? "Ouverture…" : "Ouvrir le partage"}
        </button>
      </form>
      <p>
        <Link
          href="/login?audience=clinician"
          target="_blank"
          rel="noopener noreferrer"
        >
          Se connecter comme soignant dans un autre onglet
        </Link>
      </p>
      {needsLogin && (
        <p className="notice">
          Après la connexion, revenez dans cet onglet et cliquez sur « Ouvrir le
          partage ». Le code n’est conservé que dans cette page.
        </p>
      )}
    </>
  );
}
