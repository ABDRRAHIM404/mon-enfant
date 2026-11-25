import {
  BookOpen,
  CalendarDays,
  FileText,
  Home,
  QrCode,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { ClinicianSection } from "./routes";

export function clinicianMainNavigation(provisional: boolean) {
  const base = provisional ? "/provisional" : "";
  return [
    {
      key: "home",
      label: "Tableau de bord",
      href: base || "/dashboard",
      icon: Home,
    },
    {
      key: "children",
      label: "Enfants",
      href: provisional ? `${base}/children` : "/patients",
      icon: UsersRound,
    },
    {
      key: "appointments",
      label: "Rendez-vous",
      href: `${base}/appointments`,
      icon: CalendarDays,
    },
    {
      key: "documents",
      label: "Documents",
      href: `${base}/documents`,
      icon: FileText,
      hint: "Bientôt disponible",
    },
    ...(!provisional
      ? [
          {
            key: "sharing",
            label: "Scanner un QR partagé",
            href: "/share",
            icon: QrCode,
          } as const,
        ]
      : []),
    {
      key: "guide",
      label: "Guide et aide",
      href: provisional ? `${base}/guide` : "/guide-soignant",
      icon: BookOpen,
    },
    {
      key: "account",
      label: "Mon compte soignant",
      href: "/account",
      icon: UserRound,
    },
  ] satisfies {
    key: ClinicianSection;
    label: string;
    href: string;
    icon: typeof Home;
    hint?: string;
  }[];
}
