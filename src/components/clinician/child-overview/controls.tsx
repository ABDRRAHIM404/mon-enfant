"use client";

import { Check, ChevronDown, Copy } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

export function OverviewDetails({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className="overview-card overview-details" data-expanded={open}>
      <h2 className="overview-desktop-title">
        {icon}
        {title}
      </h2>
      <h2 className="overview-mobile-title">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {icon}
          <span>{title}</span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className="overview-chevron"
          />
        </button>
      </h2>
      <div id={id} className="overview-details-body">
        <div>{children}</div>
      </div>
    </section>
  );
}

export function UniversalIdCopy({ value }: { value: string }) {
  const [status, setStatus] = useState<"copied" | "select" | null>(null);
  const id = useRef<HTMLSpanElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      const selection = window.getSelection();
      if (selection && id.current) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(id.current);
        selection.addRange(range);
      }
      setStatus("select");
    }
  }
  return (
    <div className="overview-id">
      <div>
        <span ref={id}>{value}</span>
        <button
          type="button"
          aria-label="Copier l’identifiant universel"
          onClick={() => void copy()}
        >
          {status === "copied" ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Copy size={17} aria-hidden="true" />
          )}
        </button>
      </div>
      {status && (
        <small role="status">
          {status === "copied"
            ? "Identifiant copié."
            : "Identifiant sélectionné pour copie manuelle."}
        </small>
      )}
    </div>
  );
}
