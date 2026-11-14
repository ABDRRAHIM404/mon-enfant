"use client";
import { useActionState } from "react";
import { markParentUpdatesRead } from "@/app/parent/actions";
export function MarkUpdatesRead({ through }: { through: string }) {
  const [state, action, pending] = useActionState(markParentUpdatesRead, {});
  return (
    <form action={action} aria-busy={pending}>
      <input type="hidden" name="readThrough" value={through} />
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          Notifications marquées comme consultées.
        </p>
      )}
      <button className="button secondary" disabled={pending}>
        {pending ? "Enregistrement…" : "Tout marquer comme consulté"}
      </button>
    </form>
  );
}
