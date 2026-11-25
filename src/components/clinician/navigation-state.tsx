"use client";
import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavigationFeedback } from "@/components/workspace-navigation";
import { clinicianRoute, type ClinicianSection } from "./routes";

type Selection = ReturnType<typeof clinicianRoute>;
const SelectionContext = createContext<Selection>({ section: "home" });
export function ClinicianNavigationState({
  children,
}: {
  children: ReactNode;
}) {
  const route = clinicianRoute(usePathname());
  return (
    <SelectionContext.Provider value={route}>
      {children}
    </SelectionContext.Provider>
  );
}
export function ClinicianNavLink({
  href,
  section,
  tool,
  title,
  children,
}: {
  href: string;
  section?: ClinicianSection;
  tool?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const active = useContext(SelectionContext);
  const current = tool ? active.tool === href : active.section === section;
  return (
    <Link href={href} title={title} aria-current={current ? "page" : undefined}>
      {children}
      <NavigationFeedback />
    </Link>
  );
}
export function ClinicianToolMenu({
  children,
  heading,
  desktop = false,
}: {
  children: ReactNode;
  heading: ReactNode;
  desktop?: boolean;
}) {
  const { tool } = useContext(SelectionContext);
  if (desktop && !tool) return null;
  return (
    <details className="soignant-tools" key={tool} open={Boolean(tool)}>
      <summary>{heading}</summary>
      <nav aria-label="Outils du suivi clinique">{children}</nav>
    </details>
  );
}
export function useClinicianSelection() {
  return useContext(SelectionContext);
}
