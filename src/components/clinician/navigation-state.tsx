"use client";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavigationFeedback } from "@/components/workspace-navigation";
import { clinicianRoute, type ClinicianSection } from "./routes";

type Selection = ReturnType<typeof clinicianRoute>;
const SelectionContext = createContext<Selection>({ section: "home" });
const OverrideContext = createContext<
  ((section: ClinicianSection | null) => void) | null
>(null);
export function ClinicianNavigationState({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [override, setOverride] = useState<{
    pathname: string;
    section: ClinicianSection;
  } | null>(null);
  const updateOverride = useCallback(
    (section: ClinicianSection | null) => {
      setOverride(section === null ? null : { pathname, section });
    },
    [pathname],
  );
  const route = clinicianRoute(pathname);
  const active =
    override?.pathname === pathname
      ? { ...route, section: override.section }
      : route;
  return (
    <OverrideContext.Provider value={updateOverride}>
      <SelectionContext.Provider value={active}>
        {children}
      </SelectionContext.Provider>
    </OverrideContext.Provider>
  );
}
export function ClinicianSectionOverride({
  section,
}: {
  section: ClinicianSection;
}) {
  const setOverride = useContext(OverrideContext);
  useLayoutEffect(() => {
    if (!setOverride) return;
    setOverride(section);
    return () => setOverride(null);
  }, [section, setOverride]);
  return null;
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
