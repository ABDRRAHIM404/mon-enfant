import { readAuthorizedChild } from "@/lib/registry/read-child";
import "@/components/registry/registration.css";
import "@/components/clinician/registry-filter-select.css";
import { randomUUID } from "node:crypto";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChildInformationForm } from "@/components/registry/child-information-form";
import { todayCasablanca } from "@/lib/appointments/calendar";
import { requireApprovedDoctor } from "@/lib/auth";
import { patientName, uuidPattern, type Facility } from "@/lib/registry/types";

export const dynamic = "force-dynamic";

export default async function EditChildInformation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ register?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  const { register: registerId } = await searchParams;
  if (!uuidPattern.test(id) || (registerId && !uuidPattern.test(registerId)))
    notFound();
  const child = await readAuthorizedChild(id);
  if (!child.can_manage_access) notFound();
  const register = registerId
    ? child.registers.find(({ id }) => id === registerId)
    : child.registers[0];
  if (registerId && !register) notFound();
  const { data, error } = await supabase.rpc("my_facilities");
  if (error) throw new Error("Impossible de charger les lieux d’exercice.");
  const facilities = data as Facility[];
  const base = `/patients/${id}`;
  return (
    <>
      <div className="registration-page">
        <Link className="registration-back" href={base}>
          <ArrowLeft size={17} aria-hidden="true" /> Vue d’ensemble
        </Link>
        <div className="page-heading registration-heading">
          <h1 id="main-content" tabIndex={-1}>
            {child.registers.length
              ? "Modifier les informations"
              : "Compléter le dossier"}
          </h1>
          <p>{patientName(child)}</p>
        </div>
        <section
          className="registration-panel"
          aria-label="Informations du dossier"
        >
          {facilities.length === 0 && !register && (
            <p className="notice">
              Pour attribuer un numéro local, commencez par{" "}
              <Link className="text-link" href="/practices">
                déclarer un lieu d’exercice
              </Link>
              . Vous pouvez enregistrer les autres informations dès maintenant.
            </p>
          )}
          {child.registers.length > 1 && (
            <nav
              className="registration-modes registration-registers"
              aria-label="Registre à modifier"
            >
              {child.registers.map((entry) => (
                <Link
                  key={entry.id}
                  href={`${base}/edit?register=${entry.id}`}
                  aria-current={register?.id === entry.id ? "page" : undefined}
                >
                  {entry.facility_name} · {entry.year} / {entry.book} /{" "}
                  {entry.number}
                </Link>
              ))}
            </nav>
          )}
          <ChildInformationForm
            key={register?.id ?? id}
            child={child}
            register={register}
            facilities={facilities}
            operationId={randomUUID()}
            today={todayCasablanca()}
          />
        </section>
      </div>
    </>
  );
}
