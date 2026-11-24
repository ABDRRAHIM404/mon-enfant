"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Camera,
  CameraOff,
  Flashlight,
  ImagePlus,
  SwitchCamera,
} from "lucide-react";
import { shareToken } from "@/lib/sharing/types";

type Feedback = { text: string; failure?: boolean };
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

export function ShareScanner({
  onToken,
  disabled,
  onScanStart,
}: {
  onToken: (token: string) => void;
  disabled: boolean;
  onScanStart: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const [running, setRunning] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [cameras, setCameras] = useState<string[]>([]);
  const [hasTorch, setHasTorch] = useState(false);
  const [torch, setTorch] = useState(false);
  const [changingTorch, setChangingTorch] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);

  const release = useCallback(() => {
    generation.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    release();
    if (video.current) video.current.srcObject = null;
    setRequesting(false);
    setRunning(false);
    setReadingImage(false);
    setCameras([]);
    setHasTorch(false);
    setTorch(false);
    setChangingTorch(false);
  }, [release]);

  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      release();
    };
  }, [release, stop]);

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
      setMessage({
        text: "Ce QR ne contient pas de lien de partage Mon Enfant valide.",
        failure: true,
      });
      return false;
    }
    onToken(token);
    setMessage({
      text: "Code lu. Sélectionnez « Ouvrir le partage » pour le vérifier.",
    });
    return true;
  }

  async function start(deviceId?: string) {
    stop();
    onScanStart();
    const attempt = generation.current;
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage({
        text: "Caméra indisponible. Choisissez une image ou collez le lien.",
        failure: true,
      });
      return;
    }
    setRequesting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: "environment" } }),
          width: { ideal: 720 },
        },
        audio: false,
      });
      if (attempt !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (!video.current) {
        stop();
        return;
      }
      video.current.srcObject = media;
      await video.current.play();
      if (attempt !== generation.current) return;
      setRequesting(false);
      setRunning(true);
      const track = media.getVideoTracks()[0];
      if (track) {
        try {
          setHasTorch(
            (track.getCapabilities?.() as TorchCapabilities | undefined)
              ?.torch === true,
          );
        } catch {
          setHasTorch(false);
        }
        track.addEventListener(
          "ended",
          () => {
            if (attempt !== generation.current) return;
            stop();
            setMessage({
              text: "La caméra s’est arrêtée. Choisissez une image ou collez le lien.",
              failure: true,
            });
          },
          { once: true },
        );
      }
      void navigator.mediaDevices
        .enumerateDevices?.()
        .then((devices) => {
          if (attempt === generation.current)
            setCameras([
              ...new Set(
                devices
                  .filter((item) => item.kind === "videoinput" && item.deviceId)
                  .map((item) => item.deviceId),
              ),
            ]);
        })
        .catch(() => {
          // Scanning remains available without access to the device list.
        });

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
          canvas.height = Math.max(1, Math.round(element.videoHeight * scale));
          canvas
            .getContext("2d", { willReadFrequently: true })
            ?.drawImage(element, 0, 0, canvas.width, canvas.height);
          if (await decode(canvas, attempt)) {
            if (attempt === generation.current) stop();
            return;
          }
        }
        if (attempt === generation.current && stream.current)
          timer.current = setTimeout(() => {
            void tick().catch(() => {
              if (attempt !== generation.current) return;
              stop();
              setMessage({
                text: "Lecture interrompue. Choisissez une image ou collez le lien.",
                failure: true,
              });
            });
          }, 300);
      }
      await tick();
    } catch (error) {
      if (attempt !== generation.current) return;
      stop();
      let reason = "La caméra n’a pas pu être ouverte.";
      if (error instanceof DOMException && error.name === "NotAllowedError")
        reason = "L’accès à la caméra a été refusé.";
      if (error instanceof DOMException && error.name === "NotFoundError")
        reason = "Aucune caméra disponible.";
      setMessage({
        text: `${reason} Choisissez une image ou collez le lien.`,
        failure: true,
      });
    }
  }

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || !hasTorch || changingTorch) return;
    const next = !torch,
      attempt = generation.current;
    setChangingTorch(true);
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      if (attempt === generation.current) setTorch(next);
    } catch {
      if (attempt === generation.current)
        setMessage({
          text: "La lampe n’est pas disponible pour cette caméra.",
          failure: true,
        });
    } finally {
      if (attempt === generation.current) setChangingTorch(false);
    }
  }

  async function readImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    stop();
    onScanStart();
    const attempt = generation.current;
    if (
      file.size > 4 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setMessage({
        text: "Choisissez une image PNG, JPEG ou WebP de 4 Mio maximum.",
        failure: true,
      });
      return;
    }
    setReadingImage(true);
    setMessage(null);
    const objectUrl = URL.createObjectURL(file);
    try {
      const photo = new Image();
      photo.src = objectUrl;
      await photo.decode();
      if (attempt !== generation.current) return;
      const scale = Math.min(
        1,
        1000 / Math.max(photo.naturalWidth, photo.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
      canvas
        .getContext("2d", { willReadFrequently: true })
        ?.drawImage(photo, 0, 0, canvas.width, canvas.height);
      if (!(await decode(canvas, attempt)) && attempt === generation.current)
        setMessage({
          text: "Aucun code de partage valide trouvé. Essayez une image plus nette ou collez le lien.",
          failure: true,
        });
    } catch {
      if (attempt === generation.current)
        setMessage({
          text: "Image illisible. Choisissez une autre image ou collez le lien.",
          failure: true,
        });
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (attempt === generation.current) setReadingImage(false);
    }
  }

  const cameraOn = running || requesting;

  return (
    <section
      className="qr-reader-card qr-camera"
      aria-label="Lecture du QR"
      aria-busy={requesting || readingImage}
    >
      <div className="qr-camera-actions">
        <button
          type="button"
          className="qr-reader-button qr-reader-primary"
          onClick={() => (cameraOn ? stop() : void start())}
          disabled={disabled || readingImage}
        >
          {cameraOn ? (
            <CameraOff size={20} aria-hidden="true" />
          ) : (
            <Camera size={20} aria-hidden="true" />
          )}
          {requesting
            ? "Annuler l’ouverture"
            : running
              ? "Arrêter la caméra"
              : "Scanner avec la caméra"}
        </button>
        <button
          type="button"
          className="qr-reader-button"
          disabled={disabled || readingImage}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus size={20} aria-hidden="true" />{" "}
          {readingImage ? "Lecture de l’image…" : "Choisir une image"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          aria-label="Choisir une image du QR"
          onChange={(event) => {
            void readImage(event);
          }}
        />
      </div>
      <div className="qr-viewfinder" data-running={running}>
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Caméra de lecture du QR"
          hidden={!running}
        />
        <div className="qr-viewfinder-tools">
          {running && cameras.length > 1 && (
            <button
              type="button"
              aria-label="Changer de caméra"
              title="Changer de caméra"
              disabled={disabled}
              onClick={() => {
                const current = stream.current
                  ?.getVideoTracks()[0]
                  ?.getSettings?.().deviceId;
                const index = current ? cameras.indexOf(current) : -1;
                void start(cameras[(index + 1) % cameras.length]);
              }}
            >
              <SwitchCamera size={19} aria-hidden="true" />
            </button>
          )}
          {running && hasTorch && (
            <button
              type="button"
              aria-label="Lampe de la caméra"
              title="Lampe de la caméra"
              aria-pressed={torch}
              disabled={disabled || changingTorch}
              onClick={() => {
                void toggleTorch();
              }}
            >
              <Flashlight size={19} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="qr-viewfinder-guide" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <span />
        </div>
        <p>
          {requesting
            ? "Autorisez la caméra dans le navigateur"
            : running
              ? "Placez le QR du parent dans le cadre"
              : "Caméra inactive"}
        </p>
      </div>
      <p className="qr-reader-small">L’image est lue sur cet appareil.</p>
      {message && (
        <p
          className="qr-reader-feedback"
          data-failure={!!message.failure}
          role={message.failure ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
