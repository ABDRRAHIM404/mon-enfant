import Link from "next/link";
import { Brand } from "@/components/brand";
export function DoctorNav() {
  return (
    <header className="workspace-header">
      <Brand />
      <nav aria-label="Espace médecin">
        <Link href="/dashboard">Tableau de bord</Link>
        <Link href="/patients">Patients</Link>
        <Link href="/vaccines">Vaccinations</Link>
        <Link href="/access-requests">Demandes d’accès</Link>
        <Link href="/practices">Lieux d’exercice</Link>
        <Link href="/account">Mon compte</Link>
      </nav>
    </header>
  );
}
