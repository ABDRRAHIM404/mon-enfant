import Link from "next/link";
import { Brand } from "@/components/brand";
import { requireApprovedDoctor } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  await requireApprovedDoctor();
  return (
    <main className="account-page">
      <Brand />
      <section className="account-card">
        <span className="eyebrow">ESPACE PROFESSIONNEL</span>
        <h1>Votre compte est approuvé.</h1>
        <p className="muted">
          Les fonctions cliniques seront ajoutées après la vérification
          professionnelle, selon les phases du plan de développement.
        </p>
        <Link className="button secondary" href="/account">
          Mon compte
        </Link>
      </section>
    </main>
  );
}
