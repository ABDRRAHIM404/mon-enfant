import Image from "next/image";
import { clinicianIllustration, familyIllustration } from "./art";
import {
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  Settings,
  ShieldCheck,
  Stethoscope,
  Syringe,
  UsersRound,
} from "lucide-react";
const icons = {
  children: UsersRound,
  vaccinations: Syringe,
  growth: ChartNoAxesCombined,
  appointments: CalendarDays,
  documents: FileText,
  access: ShieldCheck,
  settings: Settings,
  consultations: Stethoscope,
};
export function DashboardHeading({
  title,
  description,
  section,
  children,
  clinician = false,
}: {
  title: string;
  description: string;
  section?: string;
  children?: React.ReactNode;
  clinician?: boolean;
}) {
  const Icon = icons[section as keyof typeof icons] ?? Stethoscope;
  const illustration = clinician ? clinicianIllustration : familyIllustration;
  return (
    <section className="dashboard-page-heading">
      <div className="dashboard-heading-copy">
        <span className="eyebrow">
          {clinician ? "ESPACE SOIGNANT" : "ESPACE PARENT"}
        </span>
        <h1 id="main-content" tabIndex={-1}>
          <Icon aria-hidden="true" size={32} />
          {title}
        </h1>
        <p className="muted">{description}</p>
        {children && (
          <div className="dashboard-heading-actions">{children}</div>
        )}
      </div>
      <Image
        className="dashboard-heading-art"
        src={illustration}
        alt=""
        placeholder={illustration.blurDataURL ? "blur" : "empty"}
        width={300}
        height={160}
        sizes="(max-width: 700px) 110px, 280px"
      />
    </section>
  );
}
