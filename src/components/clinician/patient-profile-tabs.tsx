"use client";

import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  House,
  ShieldCheck,
  Syringe,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NavigationFeedback } from "@/components/workspace-navigation";
import type { PatientSection } from "./care-workspace";

const tabs = [
  { key: "overview", label: "Vue d’ensemble", suffix: "", Icon: House },
  {
    key: "consultations",
    label: "Consultations",
    suffix: "/consultations",
    Icon: Stethoscope,
  },
  {
    key: "records",
    label: "Dossier clinique",
    suffix: "/records",
    Icon: Activity,
  },
  {
    key: "vaccinations",
    label: "Vaccinations",
    suffix: "/vaccinations",
    Icon: Syringe,
  },
  {
    key: "appointments",
    label: "Rendez-vous",
    suffix: "/appointments",
    Icon: CalendarDays,
  },
  {
    key: "growth",
    label: "Croissance",
    suffix: "/growth",
    Icon: ChartNoAxesCombined,
  },
  {
    key: "guardians",
    label: "Accès des parents",
    suffix: "/guardians",
    Icon: ShieldCheck,
  },
  {
    key: "summary",
    label: "Résumé et impression",
    suffix: "/summary",
    Icon: ClipboardList,
  },
] as const;

export function PatientNavigation({
  childId,
  canManageAccess = false,
}: {
  childId: string;
  canManageAccess?: boolean;
}) {
  const pathname = usePathname();
  const segment = pathname?.split("/")[3];
  const active: PatientSection =
    tabs.find(({ key }) => key === segment)?.key ?? "overview";
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = bar.current;
    if (!nav) return;
    function align() {
      const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !selected || nav.scrollWidth <= nav.clientWidth) return;
      const { left, right } = selected.getBoundingClientRect();
      const bounds = nav.getBoundingClientRect();
      const inset = 6;
      if (left < bounds.left + inset)
        nav.scrollLeft += left - bounds.left - inset;
      if (right > bounds.right - inset)
        nav.scrollLeft += right - bounds.right + inset;
    }
    align();
    const observer = new ResizeObserver(align);
    observer.observe(nav);
    for (const tab of nav.children) observer.observe(tab);
    void document.fonts.ready.then(() => {
      if (nav.isConnected) align();
    });
    return () => observer.disconnect();
  }, [active]);
  return (
    <nav
      ref={bar}
      className="care-patient-nav no-print"
      aria-label="Rubriques du dossier enfant"
    >
      {tabs
        .filter(({ key }) => key !== "guardians" || canManageAccess)
        .map(({ key, label, suffix, Icon }) => (
          <Link
            key={key}
            href={`/patients/${childId}${suffix}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
          >
            <Icon size={16} aria-hidden="true" className="child-tab-icon" />
            {label}
            <NavigationFeedback inlineOnly />
          </Link>
        ))}
    </nav>
  );
}
