import { useState } from "react";
import { useRpc } from "../../src/lib/data";
import { today, civilAdd, name } from "../../src/lib/format";
import type { ParentWorkspaceData, AppointmentRow } from "../../src/lib/domain";
import {
  Screen,
  Card,
  Title,
  Copy,
  Button,
  Field,
  DataState,
  Pages,
} from "../../src/components/ui";
import { Appointment } from "../../src/components/appointment";
export default function Calendar() {
  const workspace = useRpc<ParentWorkspaceData>("parent_workspace"),
    [selected, setSelected] = useState(""),
    [anchor, setAnchor] = useState(today()),
    [draft, setDraft] = useState(anchor),
    [page, setPage] = useState(1);
  const child =
    workspace.data?.children.find((c) => c.id === selected) ??
    workspace.data?.children[0];
  return (
    <Screen title="Mes rendez-vous">
      <DataState
        loading={workspace.loading}
        error={workspace.error}
        onRetry={() => {
          void workspace.refresh();
        }}
      />
      {workspace.data && (
        <>
          <Copy muted>
            Rendez-vous enregistrés par les professionnels. Les horaires sont
            ceux de Casablanca.
          </Copy>
          {workspace.data.children.map((c) => (
            <Button
              key={c.id}
              secondary={c.id !== child?.id}
              onPress={() => {
                setSelected(c.id);
                setPage(1);
              }}
            >
              {name(c)}
            </Button>
          ))}
          {child ? (
            <>
              <Card>
                <Field
                  label="Début de la période (AAAA-MM-JJ)"
                  value={draft}
                  onChangeText={setDraft}
                  autoCapitalize="none"
                />
                <Button
                  secondary
                  onPress={() => {
                    if (
                      /^\d{4}-\d{2}-\d{2}$/.test(draft) &&
                      !Number.isNaN(Date.parse(draft))
                    ) {
                      setAnchor(draft);
                      setPage(1);
                    }
                  }}
                >
                  Afficher 30 jours
                </Button>
                <Button
                  secondary
                  onPress={() => {
                    const d = civilAdd(anchor, -30);
                    setAnchor(d);
                    setDraft(d);
                    setPage(1);
                  }}
                >
                  Période précédente
                </Button>
                <Button
                  secondary
                  onPress={() => {
                    const d = civilAdd(anchor, 30);
                    setAnchor(d);
                    setDraft(d);
                    setPage(1);
                  }}
                >
                  Période suivante
                </Button>
              </Card>
              <CalendarItems
                key={child.id + anchor}
                child={child.id}
                from={anchor}
                page={page}
                onPage={setPage}
              />
            </>
          ) : (
            <Card>
              <Copy>Aucun carnet lié : aucun rendez-vous disponible.</Copy>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
function CalendarItems({
  child,
  from,
  page,
  onPage,
}: {
  child: string;
  from: string;
  page: number;
  onPage: (v: number) => void;
}) {
  const view = useRpc<{ items: AppointmentRow[]; total: number }>(
    "parent_appointment_calendar",
    {
      p_child_id: child,
      p_from: from,
      p_to: civilAdd(from, 29),
      p_page: page,
      p_state: "all",
    },
  );
  return (
    <>
      <DataState
        loading={view.loading}
        error={view.error}
        onRetry={() => {
          void view.refresh();
        }}
      />
      {view.data && (
        <>
          <Title small>
            {from} au {civilAdd(from, 29)}
          </Title>
          {view.data.items.length ? (
            view.data.items.map((item) => (
              <Appointment key={item.id} item={item} />
            ))
          ) : (
            <Card>
              <Copy>Aucun rendez-vous enregistré pour cette période.</Copy>
            </Card>
          )}
          <Pages
            page={page}
            more={page * 50 < view.data.total}
            onPage={onPage}
          />
        </>
      )}
    </>
  );
}
