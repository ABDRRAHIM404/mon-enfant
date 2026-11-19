import Link from "next/link";
import { Brand } from "@/components/brand";
import {
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  Home,
  Settings,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UsersRound,
} from "lucide-react";
export type SkeletonArea = "parent" | "clinician" | "provisional" | "neutral";
export type SkeletonVariant =
  | "overview"
  | "booklet"
  | "list"
  | "form"
  | "clinical"
  | "calendar"
  | "documents";
export function DashboardSkeleton({
  variant = "overview",
  label = "Chargement de votre espace…",
}: {
  variant?: SkeletonVariant;
  label?: string;
}) {
  return (
    <div
      className={`dashboard-skeleton skeleton-${variant}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <div className="skeleton-heading">
          <div>
            <i className="skeleton-line skeleton-eyebrow" />
            <i className="skeleton-line skeleton-title" />
            <i className="skeleton-line skeleton-description" />
          </div>
          <i className="skeleton-art" />
        </div>
        {variant === "overview" && (
          <div className="skeleton-metrics">
            {[0, 1, 2, 3].map((i) => (
              <div className="skeleton-surface" key={i}>
                <i className="skeleton-avatar" />
                <div>
                  <i className="skeleton-line skeleton-number" />
                  <i className="skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        )}
        {variant === "form" ? (
          <div className="skeleton-surface skeleton-form">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <i className="skeleton-line skeleton-label" />
                <i className="skeleton-input" />
              </div>
            ))}
            <i className="skeleton-input skeleton-submit" />
          </div>
        ) : variant === "calendar" ? (
          <div className="skeleton-surface skeleton-calendar">
            {Array.from({ length: 35 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        ) : variant === "documents" ? (
          <div className="skeleton-surface skeleton-document">
            <i className="skeleton-art" />
            <i className="skeleton-line skeleton-title" />
            <i className="skeleton-line" />
          </div>
        ) : (
          <div className="skeleton-columns">
            <div className="skeleton-surface">
              {[0, 1, 2, 3].map((i) => (
                <div className="skeleton-row" key={i}>
                  <i className="skeleton-avatar" />
                  <div>
                    <i className="skeleton-line" />
                    <i className="skeleton-line skeleton-short" />
                  </div>
                  <i className="skeleton-chip" />
                </div>
              ))}
            </div>
            <div className="skeleton-surface">
              {[0, 1, 2].map((i) => (
                <div className="skeleton-row" key={i}>
                  <i className="skeleton-avatar" />
                  <div>
                    <i className="skeleton-line" />
                    <i className="skeleton-line skeleton-short" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export function DashboardLoading({
  area = "neutral",
  variant = "overview",
}: {
  area?: SkeletonArea;
  variant?: SkeletonVariant;
}) {
  const parent = area === "parent",
    base = area === "provisional" ? "/provisional" : "";
  const items = parent
    ? ([
        ["Tableau de bord", "/parent", Home],
        ["Mes enfants", "/parent?view=children", UsersRound],
        ["Vaccinations", "/parent?view=vaccinations", Syringe],
        ["Croissance", "/parent?view=growth", ChartNoAxesCombined],
        ["Rendez-vous", "/parent?view=appointments", CalendarDays],
        ["Documents", "/parent?view=documents", FileText],
        ["Partage & accès", "/parent?view=access", ShieldCheck],
        ["Paramètres", "/parent/settings", Settings],
      ] as const)
    : ([
        ["Tableau de bord", base || "/dashboard", Home],
        ["Enfants", base ? base + "/children" : "/patients", UsersRound],
        ["Consultations", base + "/consultations", Stethoscope],
        ["Vaccinations", base + "/vaccinations", Syringe],
        ["Rendez-vous", base + "/appointments", CalendarDays],
        ["Croissance", base + "/growth", ChartNoAxesCombined],
        ["Documents", base + "/documents", FileText],
        ["Mon compte soignant", "/account", Settings],
      ] as const);
  return (
    <div className={`dashboard-loading-frame loading-${area}`}>
      <header className="loading-frame-header">
        <Brand />
        <span className="skeleton-line skeleton-account" aria-hidden="true" />
      </header>
      {area !== "neutral" && (
        <aside className="loading-frame-sidebar">
          <nav aria-label="Rubriques pendant le chargement">
            {items.map(([label, href, Icon]) => (
              <Link key={label} href={href}>
                <Icon size={20} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
      )}
      <main className="loading-frame-main" id="main-content" tabIndex={-1}>
        <DashboardSkeleton variant={variant} />
      </main>
    </div>
  );
}
