import { useState } from "react";
import { useRpc } from "../../src/lib/data";
import { civilAdd, name } from "../../src/lib/format";
import {
  civilDay,
  type ParentWorkspaceData,
  type NativeAppointment,
  type NativeClock,
} from "../../src/lib/domain";
import {
  Screen,
  Card,
  Title,
  Copy,
  Button,
  Field,
  DataState,
  Pages,
  Notice,
} from "../../src/components/ui";
import { Appointment } from "../../src/components/appointment";
export default function Calendar() {
  const workspace = useRpc<ParentWorkspaceData & NativeClock>(
      "parent_mobile_view",
      { p_kind: "home" },
    ),
    [selected, setSelected] = useState(""),
    [anchor, setAnchor] = useState<string | null>(null),
    [draft, setDraft] = useState<string | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  const child =
      workspace.data?.children.find((c) => c.id === selected) ??
      workspace.data?.children[0],
    from = anchor ?? workspace.data?.server_day ?? "";
  function choose(value: string) {
    try {
      civilDay(value);
      civilAdd(value, 29);
      setAnchor(value);
      setDraft(value);
      setPage(1);
      setError("");
    } catch {
      setError(
        "Indiquez une date civile valide entre 0001 et 9999, avec une période complète de 30 jours.",
      );
    }
  }
  function move(days: number) {
    try {
      choose(civilAdd(from, days));
    } catch {
      setError("La période demandée dépasse les dates prises en charge.");
    }
  }
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
            Rendez-vous enregistrés par les professionnels. Les horaires de
            Casablanca sont fournis par le serveur.
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
          {child && from ? (
            <>
              <Card>
                <Field
                  label="Début de la période (AAAA-MM-JJ)"
                  value={draft ?? from}
                  onChangeText={setDraft}
                  autoCapitalize="none"
                />
                {error && <Notice error>{error}</Notice>}
                <Button secondary onPress={() => choose(draft ?? from)}>
                  Afficher 30 jours
                </Button>
                <Button secondary onPress={() => move(-30)}>
                  Période précédente
                </Button>
                <Button secondary onPress={() => move(30)}>
                  Période suivante
                </Button>
              </Card>
              <CalendarItems
                key={child.id + from}
                child={child.id}
                from={from}
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
  const view = useRpc<{ items: NativeAppointment[]; total: number }>(
    "parent_mobile_view",
    {
      p_kind: "calendar",
      p_child_id: child,
      p_from: from,
      p_to: civilAdd(from, 29),
      p_page: page,
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
