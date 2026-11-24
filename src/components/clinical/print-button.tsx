"use client";
export function PrintButton({ prominent = false }: { prominent?: boolean }) {
  return (
    <button
      type="button"
      className={
        prominent
          ? "button primary child-button child-spotlight no-print"
          : "button secondary no-print"
      }
      onClick={() => window.print()}
    >
      Imprimer / enregistrer en PDF
    </button>
  );
}
