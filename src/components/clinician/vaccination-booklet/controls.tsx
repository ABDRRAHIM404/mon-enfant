"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { reviewBookletDose } from "@/app/(soignant)/(verified)/patients/[id]/vaccinations/review-actions";

export function BookletScroll({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const id = useId();
  const [hasOverflow, setHasOverflow] = useState(false);
  const [position, setPosition] = useState(0);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(true);
  function measure() {
    const node = viewport.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setHasOverflow(max > 1);
    setPosition(max ? node.scrollLeft / max : 0);
    setCanScrollBack(node.scrollLeft > 1);
    setCanScrollForward(node.scrollLeft < max - 1);
  }
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, []);
  function move(direction: number) {
    const node = viewport.current;
    if (!node) return;
    node.scrollBy({
      left: direction * Math.max(130, node.clientWidth * 0.65),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <>
      <div
        className="booklet-scroll"
        tabIndex={0}
        role="region"
        aria-label="Tableau du calendrier vaccinal"
        aria-describedby={hasOverflow ? `${id}-hint` : undefined}
        id={id}
        ref={viewport}
        onScroll={measure}
      >
        {children}
      </div>
      {hasOverflow && (
        <>
          <div className="booklet-scroll-controls">
            <button
              type="button"
              aria-label="Faire défiler vers la gauche"
              aria-controls={id}
              disabled={!canScrollBack}
              onClick={() => move(-1)}
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <div className="booklet-scroll-track" aria-hidden="true">
              <span style={{ insetInlineStart: `${position * 75}%` }} />
            </div>
            <button
              type="button"
              aria-label="Faire défiler vers la droite"
              aria-controls={id}
              disabled={!canScrollForward}
              onClick={() => move(1)}
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
          <p id={`${id}-hint`} className="booklet-scroll-hint">
            Faites glisser horizontalement pour voir plus de colonnes
          </p>
        </>
      )}
    </>
  );
}

export function BookletReviewForm({
  child,
  version,
  dose,
  operation,
  previous,
  outstanding,
}: {
  child: string;
  version: string;
  dose: string;
  operation: string;
  previous?: string;
  outstanding: boolean;
}) {
  const [state, action, pending] = useActionState(reviewBookletDose, {});
  return (
    <details className="booklet-dose-review">
      <summary>
        {outstanding
          ? "Retirer la confirmation"
          : "Confirmer la dose manquante"}
      </summary>
      <form
        action={action}
        aria-busy={pending}
        onReset={(event) => event.preventDefault()}
      >
        {Object.entries({
          child,
          version,
          dose,
          operation,
          previous: previous ?? "",
          decision: outstanding ? "retract" : "confirm",
        }).map(([name, value]) => (
          <input type="hidden" name={name} value={value} key={name} />
        ))}
        <label>
          Motif et source contrôlée
          <textarea
            name="reason"
            rows={3}
            required
            minLength={10}
            maxLength={1000}
            disabled={pending || state.saved}
          />
        </label>
        <label className="booklet-review-check">
          <input
            name="reviewed"
            type="checkbox"
            required
            disabled={pending || state.saved}
          />
          {outstanding
            ? "J’ai vérifié le motif du retrait."
            : "J’ai vérifié que cette dose n’a pas été administrée."}
        </label>
        {state.error && <p role="alert">{state.error}</p>}
        {state.saved && <p role="status">Décision enregistrée.</p>}
        <button className="button secondary" disabled={pending || state.saved}>
          {pending ? "Enregistrement…" : "Enregistrer la décision"}
        </button>
      </form>
    </details>
  );
}
