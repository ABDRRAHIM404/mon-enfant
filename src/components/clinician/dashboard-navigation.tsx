"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  Home,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { NavigationFeedback } from "@/components/workspace-navigation";

export function DashboardAccount({
  role,
  status,
  verified,
  children,
}: {
  role: string;
  status: string;
  verified: boolean;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const details = menu.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      )
        details.open = false;
    }
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (menu.current) menu.current.open = false;
        document.getElementById("soignant-search")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", shortcut);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", shortcut);
    };
  }, []);
  return (
    <details
      className="care-account"
      ref={menu}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="Mon compte soignant">
        <span className="care-account-icon">
          <UserRound size={23} aria-hidden="true" />
        </span>
        <span className="care-account-label">
          <strong>{role}</strong>
          <small>{status}</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div
        className="care-account-panel"
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("a") &&
            menu.current
          )
            menu.current.open = false;
        }}
      >
        <div className="care-account-identity">
          {verified && <ShieldCheck size={19} aria-hidden="true" />}
          <span>
            <strong>{role}</strong>
            <small>{status}</small>
          </span>
        </div>
        {children}
      </div>
    </details>
  );
}

export function DashboardLogout() {
  const { pending } = useFormStatus();
  return (
    <button className="soignant-logout" disabled={pending}>
      <LogOut size={18} aria-hidden="true" />
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}

export function DashboardMobileNavigation({
  children,
}: {
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const close = () => dialog.current?.close();
  return (
    <div className="care-mobile-navigation">
      <nav aria-label="Navigation principale soignant">
        <Link href="/dashboard" aria-current="page">
          <Home size={22} aria-hidden="true" />
          Tableau de bord
          <NavigationFeedback />
        </Link>
        <Link href="/patients">
          <UsersRound size={22} aria-hidden="true" />
          Enfants
          <NavigationFeedback />
        </Link>
        <Link href="/appointments">
          <CalendarDays size={22} aria-hidden="true" />
          Rendez-vous
          <NavigationFeedback />
        </Link>
        <button
          type="button"
          aria-controls="care-feature-drawer"
          aria-haspopup="dialog"
          onClick={() => dialog.current?.showModal()}
        >
          <Menu size={22} aria-hidden="true" />
          Menu
        </button>
      </nav>
      <dialog
        ref={dialog}
        id="care-feature-drawer"
        className="care-drawer"
        aria-labelledby="care-feature-drawer-title"
        onClick={(event) => {
          if (
            event.target === event.currentTarget ||
            (event.target instanceof Element && event.target.closest("a"))
          )
            close();
        }}
      >
        <div
          className="care-drawer-content"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            start.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            const first = start.current;
            start.current = null;
            const end = event.changedTouches[0];
            if (
              first &&
              first.x - end.clientX > 80 &&
              Math.abs(first.y - end.clientY) < 50
            )
              close();
          }}
        >
          <header>
            <h2 id="care-feature-drawer-title">Espace soignant</h2>
            <button type="button" onClick={close} aria-label="Fermer le menu">
              <X size={22} aria-hidden="true" />
            </button>
          </header>
          {children}
        </div>
      </dialog>
    </div>
  );
}
