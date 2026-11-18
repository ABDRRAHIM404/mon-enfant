import { patientName, birthLabel } from "@/lib/registry/types";
import type { ParentChild } from "@/lib/parents/types";
import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { NavigationFeedback } from "@/components/workspace-navigation";
export type ParentChildSection =
  "booklet" | "vaccinations" | "appointments" | "requests" | "privacy";
export function ParentChildNavigation({
  childId,
  active = "booklet",
}: {
  childId: string;
  active?: ParentChildSection;
}) {
  const items = [
    { key: "booklet", label: "Carnet", href: `/parent/children/${childId}` },
    {
      key: "vaccinations",
      label: "Vaccinations",
      href: `/parent/children/${childId}/vaccinations`,
    },
    {
      key: "growth",
      label: "Croissance",
      href: `/parent?view=growth&child=${childId}`,
    },
    {
      key: "appointments",
      label: "Rendez-vous",
      href: `/parent/children/${childId}/appointments`,
    },
    {
      key: "requests",
      label: "Demandes et réponses",
      href: `/parent/children/${childId}/requests`,
    },
    {
      key: "privacy",
      label: "Partage et accès",
      href: `/parent/children/${childId}/privacy`,
    },
  ];
  return (
    <nav
      className="care-patient-nav parent-child-navigation no-print"
      aria-label="Rubriques du carnet de cet enfant"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
        >
          {item.label}
          <NavigationFeedback />
        </Link>
      ))}
    </nav>
  );
}
export function ParentWorkflow({
  active = "children",
  childId,
  child,
  childSection,
  unread,
  children,
}: {
  active?: string;
  childId?: string;
  child?: ParentChild;
  childSection?: ParentChildSection;
  unread?: number;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceShell area="parent" active={active} unread={unread}>
      <div className="parent-workflow">
        {childId && (
          <>
            <nav className="care-breadcrumb no-print" aria-label="Fil d’Ariane">
              <Link href="/parent?view=children">← Mes enfants</Link>
              <Link href={`/parent/children/${childId}`}>
                Carnet de mon enfant
              </Link>
            </nav>
            {child && (
              <div className="care-child-context">
                <span className="care-child-symbol" aria-hidden="true">
                  {patientName(child).slice(0, 1)}
                </span>
                <div>
                  <strong>{patientName(child)}</strong>
                  <span>{birthLabel(child)}</span>
                </div>
              </div>
            )}
            <ParentChildNavigation childId={childId} active={childSection} />
          </>
        )}
        {children}
      </div>
    </WorkspaceShell>
  );
}
