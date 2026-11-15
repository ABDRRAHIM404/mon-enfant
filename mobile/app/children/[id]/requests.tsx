import { useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import { useRpc, useAction, useNativeView } from "../../../src/lib/data";
import {
  clinicalLabels,
  type ParentBooklet,
  type CorrectionPage,
} from "../../../src/lib/domain";
import { instant } from "../../../src/lib/format";
import {
  Screen,
  Card,
  Title,
  Copy,
  Button,
  Field,
  Notice,
  DataState,
  Pages,
} from "../../../src/components/ui";
export default function Requests() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    [page, setPage] = useState(1),
    view = useRpc<CorrectionPage>("parent_corrections", {
      p_child_id: id,
      p_page: page,
    }),
    action = useAction(),
    [category, setCategory] = useState("clinical"),
    [message, setMessage] = useState(""),
    [entry, setEntry] = useState<string | null>(null),
    operation = useRef<{ payload: string; id: string } | null>(null);
  async function send() {
    const payload = JSON.stringify({ id, category, message, entry });
    if (operation.current?.payload !== payload)
      operation.current = { payload, id: Crypto.randomUUID() };
    const value = await action.run(
      "request_parent_correction",
      {
        p_operation_id: operation.current.id,
        p_child_id: id,
        p_category: category,
        p_entry_id: category === "clinical" ? entry : null,
        p_message: message,
      },
      "Votre demande a été transmise au professionnel.",
    );
    if (value) {
      setMessage("");
      operation.current = null;
      void view.refresh();
    }
  }
  return (
    <Screen back title="Demander une vérification">
      <DataState
        loading={view.loading}
        error={view.error}
        onRetry={() => {
          void view.refresh();
        }}
      />
      {view.data && (
        <>
          <Card>
            <Title small>Nouvelle demande</Title>
            <Copy>
              Votre demande ne modifie pas le dossier. Un professionnel autorisé
              vérifie les informations et conserve la trace de sa réponse.
            </Copy>
            {[
              ["clinical", "Information clinique"],
              ["identity", "Identité de l’enfant"],
              ["access", "Accès au carnet"],
              ["other", "Autre question"],
            ].map(([value, label]) => (
              <Button
                key={value}
                secondary={category !== value}
                onPress={() => {
                  setCategory(value);
                  setEntry(null);
                }}
              >
                {label}
              </Button>
            ))}
            {category === "clinical" && (
              <EntryChoices childId={id} selected={entry} onSelect={setEntry} />
            )}
            <Field
              label="Votre demande (20 caractères minimum)"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={2000}
            />
            {action.error && <Notice error>{action.error}</Notice>}
            {action.message && <Notice>{action.message}</Notice>}
            <Button
              disabled={
                action.busy ||
                Array.from(message.trim()).length < 20 ||
                (category === "clinical" && !entry)
              }
              onPress={() => {
                void send();
              }}
            >
              Envoyer ma demande
            </Button>
          </Card>
          <Title small>Mes demandes et réponses</Title>
          {view.data.items.map((item) => (
            <Card key={item.id}>
              <Copy>{item.message}</Copy>
              <Copy small muted>
                {instant(item.created_at)}
              </Copy>
              {item.response ? (
                <>
                  <Title small>Réponse du professionnel</Title>
                  <Copy>{item.response.message}</Copy>
                  <Copy small>
                    {item.response.professional_id} ·{" "}
                    {instant(item.response.created_at)}
                  </Copy>
                </>
              ) : (
                <Copy muted>En attente d’une réponse.</Copy>
              )}
            </Card>
          ))}
          {!view.data.items.length && (
            <Copy muted>Aucune demande enregistrée.</Copy>
          )}
          <Pages
            page={page}
            more={page * 30 < view.data.total}
            onPage={setPage}
          />
        </>
      )}
    </Screen>
  );
}

function EntryChoices({
  childId,
  selected,
  onSelect,
}: {
  childId: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [page, setPage] = useState(1),
    view = useNativeView<ParentBooklet>("booklet", {
      p_child_id: childId,
      p_page: page,
    });
  return (
    <>
      <Title small>Entrée clinique à vérifier</Title>
      <DataState
        loading={view.loading}
        error={view.error}
        onRetry={() => {
          void view.refresh();
        }}
      />
      {view.data && (
        <>
          {view.data.entries.map((e) => (
            <Button
              key={e.id}
              secondary={selected !== e.id}
              onPress={() => onSelect(e.id)}
            >{`${clinicalLabels[e.kind]} · ${e.occurred_on || "Date inconnue"} · révision ${e.revision} · ${e.professional_id}`}</Button>
          ))}
          {!view.data.entries.length && (
            <Copy muted>
              Aucune entrée clinique active sur cette page. Pour une question
              générale, choisissez « Autre question ».
            </Copy>
          )}
          <Pages
            page={page}
            more={page * 30 < view.data.entry_total}
            onPage={(n) => {
              onSelect(null);
              setPage(n);
            }}
          />
        </>
      )}
    </>
  );
}
