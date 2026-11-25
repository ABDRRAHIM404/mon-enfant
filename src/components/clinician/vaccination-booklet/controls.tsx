"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FrenchDateInput } from "@/components/appointments/french-date-input";
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
  existingRecord,
  entryForm,
  hasRoutineDate,
  today,
}: {
  child: string;
  version: string;
  dose: string;
  operation: string;
  previous?: string;
  existingRecord?: string;
  entryForm: string;
  hasRoutineDate: boolean;
  today: string;
}) {
  const [state, action, pending] = useActionState(reviewBookletDose, {});
  const [decision, setDecision] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const administered = decision === "administered";
  const hasReason = administered || decision === "not_administered";
  const needsCorrection = !!existingRecord && hasReason;
  const lacksReference = decision === "not_administered" && !hasRoutineDate;
  return (
    <>
      <button
        type="button"
        className="booklet-review-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        Vérifier la vaccination
      </button>
      <dialog
        className="booklet-review-dialog"
        aria-labelledby={id}
        ref={dialog}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending)
            dialog.current?.close();
        }}
      >
        <div className="booklet-review-sheet">
          <div className="booklet-review-heading">
            <div>
              <h2 id={id}>Vérifier la vaccination</h2>
              <p>{dose}</p>
            </div>
            <button
              type="button"
              aria-label="Fermer la vérification"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
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
            }).map(([name, value]) => (
              <input type="hidden" name={name} value={value} key={name} />
            ))}
            <fieldset disabled={pending || state.saved}>
              <legend>Résultat de la vérification</legend>
              <div className="booklet-review-choices">
                {[
                  ["administered", "Dose administrée"],
                  ["not_administered", "Dose non administrée"],
                  ["uncertain", "Information non confirmée"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="decision"
                      value={value}
                      required
                      checked={decision === value}
                      onChange={() => setDecision(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {needsCorrection ? (
                <p className="booklet-review-help">
                  Une saisie existe déjà pour cette dose.{" "}
                  <a href={existingRecord}>
                    Ouvrir l’historique et corriger la saisie
                  </a>
                  .
                </p>
              ) : lacksReference ? (
                <p className="booklet-review-help">
                  Aucune date PNI calculable pour cette dose. Consultez la
                  référence avant de déterminer son état.
                </p>
              ) : (
                <>
                  {administered && (
                    <label className="booklet-review-field">
                      Date d’administration
                      <FrenchDateInput name="administeredOn" max={today} />
                    </label>
                  )}
                  {hasReason && (
                    <label className="booklet-review-field">
                      Motif et source de l’information
                      <textarea
                        name="reason"
                        rows={3}
                        required
                        minLength={10}
                        maxLength={1000}
                      />
                    </label>
                  )}
                  {administered && (
                    <p className="booklet-review-help">
                      <a href={entryForm}>
                        Date inconnue ou estimée · Ouvrir la saisie complète
                      </a>
                    </p>
                  )}
                </>
              )}
            </fieldset>
            {state.error && (
              <p role="alert" className="form-error">
                {state.error}
              </p>
            )}
            {state.saved && <p role="status">Décision enregistrée.</p>}
            {state.saved ? (
              <button
                type="button"
                className="booklet-button"
                onClick={() => dialog.current?.close()}
              >
                Fermer
              </button>
            ) : (
              <button
                className="booklet-button is-primary"
                disabled={
                  pending || !decision || needsCorrection || lacksReference
                }
              >
                {pending ? "Enregistrement…" : "Enregistrer la décision"}
              </button>
            )}
          </form>
        </div>
      </dialog>
    </>
  );
}
