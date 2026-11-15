import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useRpc } from "../../../src/lib/data";
import type {
  ClinicalEntry,
  ParentChild,
  PatientVaccineItem,
} from "../../../src/lib/domain";
import { uuid, name } from "../../../src/lib/format";
import {
  Screen,
  Copy,
  Title,
  Card,
  DataState,
  Pages,
} from "../../../src/components/ui";
import { Entry } from "../../../src/components/clinical";
import { VaccineReference } from "../../../src/components/vaccines";
import { ParentSharing } from "../../../src/components/sharing";
export default function Vaccinations() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    [page, setPage] = useState(1),
    [historyPage, setHistoryPage] = useState(1),
    refs = useRpc<{
      child: ParentChild;
      items: PatientVaccineItem[];
      total: number;
    }>("parent_vaccine_items", {
      p_child_id: uuid.test(id ?? "") ? id : null,
      p_page: page,
    }),
    history = useRpc<{ items: ClinicalEntry[]; total: number }>(
      "parent_vaccination_history",
      { p_child_id: uuid.test(id ?? "") ? id : null, p_page: historyPage },
    );
  return (
    <Screen back title="Vaccinations">
      <DataState
        loading={refs.loading || history.loading}
        error={refs.error || history.error}
        onRetry={() => {
          void refs.refresh();
          void history.refresh();
        }}
      />
      {refs.data && history.data && (
        <>
          <Title small>{name(refs.data.child)}</Title>
          <Copy muted>
            {history.data.total} entrée(s) vaccinale(s) active(s) ·{" "}
            {refs.data.total} référence(s) assignée(s). Ces nombres ne mesurent
            pas la couverture vaccinale.
          </Copy>
          <Title small>Historique des vaccinations</Title>
          {history.data.items.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
          {!history.data.items.length && (
            <Card>
              <Copy>
                Aucune entrée vaccinale active enregistrée. Une information
                absente ne prouve pas une dose manquée.
              </Copy>
            </Card>
          )}
          <Pages
            page={historyPage}
            more={historyPage * 20 < history.data.total}
            onPage={setHistoryPage}
          />
          <Title small>Références du carnet</Title>
          {refs.data.items.map((item) => (
            <VaccineReference
              key={item.id}
              item={item}
              child={refs.data!.child}
            />
          ))}
          {!refs.data.items.length && (
            <Card>
              <Copy>
                Aucune référence assignée. La source initiale du calendrier
                reste brouillon jusqu’à sa revue qualifiée ; aucun rattrapage
                n’est calculé.
              </Copy>
            </Card>
          )}
          <Pages
            page={page}
            more={page * 20 < refs.data.total}
            onPage={setPage}
          />
          <ParentSharing childId={id} />
        </>
      )}
    </Screen>
  );
}
