"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, CameraOff } from "lucide-react";
import { shareToken } from "@/lib/sharing/types";
export function ShareScanner({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    generation = useRef(0);
  const [running, setRunning] = useState(false),
    [requesting, setRequesting] = useState(false),
    [message, setMessage] = useState("");
  function stop() {
    generation.current += 1;
    setRequesting(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setRunning(false);
  }
  useEffect(
    () => () => {
      generation.current += 1;
      if (timer.current) clearTimeout(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  async function decode(canvas: HTMLCanvasElement, attempt: number) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    const { default: jsQR } = await import("jsqr");
    if (attempt !== generation.current) return false;
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(data.data, data.width, data.height, {
      inversionAttempts: "attemptBoth",
    });
    if (!result) return false;
    const token = shareToken(result.data, window.location.origin);
    if (!token) {
      setMessage("Ce QR n’est pas un partage temporaire de cette application.");
      return false;
    }
    onToken(token);
    setMessage("Code lu. Confirmez l’ouverture du partage ci-dessous.");
    return true;
  }
  async function start() {
    if (requesting || running) return;
    stop();
    const attempt = generation.current;
    setRequesting(true);
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "Caméra indisponible. Collez le lien ou choisissez une image du QR.",
      );
      setRequesting(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 720 } },
        audio: false,
      });
      if (attempt !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (!video.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      video.current.srcObject = media;
      await video.current.play();
      if (attempt !== generation.current) return;
      setRequesting(false);
      setRunning(true);
      const canvas = document.createElement("canvas");
      async function tick() {
        if (attempt !== generation.current || !stream.current || !video.current)
          return;
        const element = video.current;
        if (element.videoWidth && element.readyState >= 2) {
          const scale = Math.min(
            1,
            720 / Math.max(element.videoWidth, element.videoHeight),
          );
          canvas.width = Math.max(1, Math.round(element.videoWidth * scale));
          canvas.height = Math.round(
            (element.videoHeight * canvas.width) / element.videoWidth,
          );
          canvas
            .getContext("2d")
            ?.drawImage(element, 0, 0, canvas.width, canvas.height);
          if (await decode(canvas, attempt)) {
            stop();
            return;
          }
        }
        if (attempt === generation.current && stream.current)
          timer.current = setTimeout(() => {
            void tick().catch(() => {
              if (attempt !== generation.current) return;
              stop();
              setMessage(
                "Lecture interrompue. Collez le lien ou choisissez une image.",
              );
            });
          }, 300);
      }
      await tick();
    } catch {
      if (attempt !== generation.current) return;
      stop();
      setMessage(
        "La caméra n’a pas pu être ouverte. Vous pouvez coller le lien ou choisir une image du QR.",
      );
    }
  }
  async function image(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    stop();
    const attempt = generation.current;
    if (!file) return;
    if (
      file.size > 4 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setMessage("Choisissez une image PNG, JPEG ou WebP de 4 Mio maximum.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: 1000,
        resizeHeight: 1000,
        resizeQuality: "low",
      });
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        if (!(await decode(canvas, attempt)) && attempt === generation.current)
          setMessage(
            "Aucun code de partage valide trouvé. Essayez une image plus nette ou collez le lien.",
          );
      } finally {
        bitmap.close();
      }
    } catch {
      if (attempt !== generation.current) return;
      setMessage("Image illisible. Collez le lien de partage.");
    }
  }
  return (
    <section className="share-scanner">
      <div className="actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            void start();
          }}
          disabled={running || requesting}
        >
          <Camera size={18} aria-hidden="true" />
          Scanner le QR
        </button>
        {(running || requesting) && (
          <button type="button" className="button secondary" onClick={stop}>
            <CameraOff size={18} aria-hidden="true" />
            Arrêter la caméra
          </button>
        )}
      </div>
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        aria-label="Caméra de lecture du QR"
        hidden={!running}
      />
      <label>
        Ou choisir une image du QR
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            void image(event);
          }}
        />
      </label>
      <p className="fine">
        L’image est lue sur cet appareil et n’est pas envoyée au serveur.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
