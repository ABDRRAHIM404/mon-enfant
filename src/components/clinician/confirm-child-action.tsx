"use client";

import { useId, useRef, type ReactNode } from "react";

export function ConfirmChildAction({
  children,
  title,
  description,
  confirmLabel = "Confirmer",
}: {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<{
    form: HTMLFormElement;
    submitter?: HTMLButtonElement | HTMLInputElement;
  } | null>(null);
  const confirmed = useRef(false);
  const heading = useId();
  const details = useId();

  return (
    <>
      <div
        onSubmitCapture={(event) => {
          if (
            confirmed.current ||
            !(event.target instanceof HTMLFormElement) ||
            !dialog.current
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          pending.current = {
            form: event.target,
            submitter:
              submitter instanceof HTMLButtonElement ||
              submitter instanceof HTMLInputElement
                ? submitter
                : undefined,
          };
          dialog.current.showModal();
        }}
      >
        {children}
      </div>
      <dialog
        ref={dialog}
        className="child-sensitive-dialog"
        aria-labelledby={heading}
        aria-describedby={details}
        onClose={() => {
          pending.current = null;
        }}
      >
        <h2 id={heading}>{title}</h2>
        <p id={details}>{description}</p>
        <div className="child-page-actions">
          <button
            className="button secondary child-button"
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            Annuler
          </button>
          <button
            className="button primary child-button"
            type="button"
            onClick={() => {
              const submission = pending.current;
              pending.current = null;
              dialog.current?.close();
              if (!submission?.form.isConnected) return;
              confirmed.current = true;
              try {
                submission.form.requestSubmit(submission.submitter);
              } finally {
                confirmed.current = false;
              }
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
