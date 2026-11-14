import Link from "next/link";
import { randomUUID } from "node:crypto";
import { CorrectionResponseForm } from "./request-forms";
import {
  correctionCategories,
  correctionOutcomes,
  type CorrectionPage,
} from "@/lib/parents/types";
export function CorrectionList({
  data,
  parent = false,
}: {
  data: CorrectionPage;
  parent?: boolean;
}) {
  return (
    <div className="record-list">
      {data.items.map((request) => (
        <article key={request.id} className="panel">
          <h2>{correctionCategories[request.category]}</h2>
          <p>
            {[request.child_given_name, request.child_family_name]
              .filter(Boolean)
              .join(" ") || "Identité inconnue"}{" "}
            · {request.universal_id}
          </p>
          <p className="fine">
            Soumise le {new Date(request.created_at).toLocaleString("fr-MA")}{" "}
            {!parent && `par ${request.guardian_display_name}`}
          </p>
          <p className="clinical-text">{request.message}</p>
          {request.entry_revision && (
            <p className="fine">
              Entrée clinique : version {request.entry_revision} au moment de la
              demande.
            </p>
          )}
          {!parent && (
            <Link
              className="text-link"
              href={
                request.root_id
                  ? `/patients/${request.child_id}/records/${request.root_id}`
                  : `/patients/${request.child_id}`
              }
            >
              Consulter le dossier et son historique
            </Link>
          )}
          {request.response ? (
            <div className="notice">
              <h3>{correctionOutcomes[request.response.outcome]}</h3>
              <p className="clinical-text">{request.response.message}</p>
              <p className="fine">
                {new Date(request.response.created_at).toLocaleString("fr-MA")}
                {request.response.professional_id &&
                  ` · Professionnel ${request.response.professional_id}`}
              </p>
              {request.response.correction_entry_id && (
                <p className="fine">
                  Une nouvelle révision a été référencée. L’entrée initiale
                  reste conservée dans l’historique.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="notice">En attente de traitement</p>
              <CorrectionResponseForm
                requestId={request.id}
                childId={request.child_id}
                operationId={randomUUID()}
                parent={parent}
                corrections={request.correction_options}
              />
            </>
          )}
        </article>
      ))}
      {!data.items.length && <p>Aucune demande sur cette page.</p>}
    </div>
  );
}
export function RequestPagination({
  total,
  page,
}: {
  total: number;
  page: number;
}) {
  return (
    <nav className="actions" aria-label="Pages des demandes">
      {page > 1 && (
        <Link className="button secondary" href={`?page=${page - 1}`}>
          Page précédente
        </Link>
      )}
      {page * 30 < total && (
        <Link className="button secondary" href={`?page=${page + 1}`}>
          Page suivante
        </Link>
      )}
    </nav>
  );
}
