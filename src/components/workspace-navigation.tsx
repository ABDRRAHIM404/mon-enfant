"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DashboardSkeleton, type SkeletonVariant } from "./dashboard/skeleton";
import { useLinkStatus } from "next/link";
import { LoaderCircle, Menu } from "lucide-react";
export function NavigationFeedback() {
  const { pending } = useLinkStatus();
  const anchor = useRef<HTMLSpanElement>(null);
  const [overlay, setOverlay] = useState<{
    left: number;
    top: number;
    variant: SkeletonVariant;
  } | null>(null);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      const link = anchor.current?.closest("a");
      const root = anchor.current?.closest(
        ".workspace-site,.soignant-workspace,.admin-workspace",
      );
      const main = root?.querySelector("main");
      if (!link || !main) return;
      const url = new URL(link.href);
      const target = url.pathname + "/" + (url.searchParams.get("view") ?? "");
      const variant: SkeletonVariant =
        url.pathname === "/parent" && !url.searchParams.has("view")
          ? "booklet"
          : /settings|account|\/new|\/admin\/verifications\/[0-9a-f-]{36}/.test(
                target,
              )
            ? "form"
            : /documents/.test(target)
              ? "documents"
              : /appointments/.test(target)
                ? "calendar"
                : /growth|vaccinations|consultations/.test(target)
                  ? "clinical"
                  : /children|patients|\/admin|\/vaccines/.test(target)
                    ? "list"
                    : "overview";
      const bounds = main.getBoundingClientRect();
      setOverlay({
        left: Math.max(0, bounds.left),
        top: Math.max(0, bounds.top),
        variant,
      });
    }, 120);
    return () => {
      window.clearTimeout(timer);
      setOverlay(null);
    };
  }, [pending]);
  useEffect(() => {
    if (!overlay) return;
    const main = anchor.current
      ?.closest(".workspace-site,.soignant-workspace,.admin-workspace")
      ?.querySelector("main");
    if (!main) return;
    const previous = main.inert;
    main.inert = true;
    return () => {
      main.inert = previous;
    };
  }, [overlay]);
  return (
    <>
      <span
        ref={anchor}
        className={
          pending
            ? "workspace-nav-feedback is-pending"
            : "workspace-nav-feedback"
        }
        aria-live="polite"
      >
        <LoaderCircle size={14} aria-hidden="true" />
        <span className="sr-only">
          {pending ? "Chargement de la page…" : ""}
        </span>
      </span>
      {pending &&
        overlay &&
        createPortal(
          <div
            className="dashboard-navigation-overlay"
            style={{ left: overlay.left, top: overlay.top }}
          >
            <DashboardSkeleton variant={overlay.variant} />
          </div>,
          document.body,
        )}
    </>
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
