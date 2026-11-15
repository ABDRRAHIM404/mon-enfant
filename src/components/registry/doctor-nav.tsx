import Link from "next/link";
import { Brand } from "@/components/brand";
export function DoctorNav() {
  return (
    <header className="workspace-header">
      <Brand />
      <nav aria-label="Espace soignant">
        <Link href="/dashboard">Tableau de bord</Link>
        <Link href="/patients">Patients</Link>
        <Link href="/vaccines">Vaccinations</Link>
        <Link href="/appointments">Calendrier</Link>
        <Link href="/follow-up">Suivis</Link>
        <Link href="/access-requests">Demandes d’accès</Link>
        <Link href="/registration-reviews">Revues d’inscription</Link>
        <Link href="/parent-requests">Demandes des parents</Link>
        <Link href="/practices">Lieux d’exercice</Link>
        <Link href="/provisional">Dossiers provisoires</Link>
        <Link href="/share">Lire un partage parent</Link>
        <Link href="/account">Mon compte</Link>
      </nav>
    </header>
  );
}
