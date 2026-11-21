import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { LinkForm } from "@/components/registry/forms";
import { uuidPattern } from "@/lib/registry/types";
import type { Facility } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function LinkPatient({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; identifier?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { mode, identifier } = await searchParams;
  const request = mode !== "authorized";
  const { data, error } = await supabase.rpc("my_facilities");
  if (error) throw new Error("Impossible de charger les lieux d’exercice.");
  const facilities = data as Facility[];
  return (
    <ClinicalWorkspace active="children">
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Rattacher un dossier existant
        </h1>
        <p className="muted">
          Un même enfant conserve son identifiant universel entre les
          professionnels. Chaque professionnel conserve son numéro local.
        </p>
      </div>
      <div className="tabs">
        <Link href="/patients/link" aria-current={request ? "page" : undefined}>
          Demander un accès
        </Link>
        <Link
          href="/patients/link?mode=authorized"
          aria-current={!request ? "page" : undefined}
        >
          J’ai déjà un accès
        </Link>
      </div>
      <section className="panel">
        {facilities.length ? (
          <LinkForm
            key={request ? "request" : "link"}
            operationId={randomUUID()}
            facilities={facilities}
            request={request}
            initialUniversalId={
              identifier && uuidPattern.test(identifier)
                ? identifier
                : undefined
            }
          />
        ) : (
          <p>
            Déclarez d’abord un{" "}
            <Link className="text-link" href="/practices">
              lieu d’exercice
            </Link>
            .
          </p>
        )}
      </section>
    </ClinicalWorkspace>
  );
}
