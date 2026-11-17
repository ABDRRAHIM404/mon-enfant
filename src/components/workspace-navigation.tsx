"use client";
import { useRef, type ReactNode } from "react";
import { useLinkStatus } from "next/link";
import { LoaderCircle, Menu } from "lucide-react";
export function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return (
    <span
      className={
        pending ? "workspace-nav-feedback is-pending" : "workspace-nav-feedback"
      }
      aria-live="polite"
    >
      <LoaderCircle size={14} aria-hidden="true" />
      <span className="sr-only">{pending ? "Chargement de la page…" : ""}</span>
    </span>
  );
}
export function WorkspaceMobileMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  return (
    <details
      className="workspace-mobile-menu"
      ref={details}
      onKeyDown={(event) => {
        if (event.key === "Escape" && details.current?.open) {
          event.preventDefault();
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a"))
          details.current?.removeAttribute("open");
      }}
    >
      <summary>
        <Menu size={18} aria-hidden="true" />
        {label}
      </summary>
      {children}
    </details>
  );
}
