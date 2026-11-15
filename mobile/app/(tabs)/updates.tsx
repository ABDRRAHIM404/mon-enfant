import { useState } from "react";
import { useRouter } from "expo-router";
import { useRpc, useAction } from "../../src/lib/data";
import { instant } from "../../src/lib/format";
import type { ParentUpdates } from "../../src/lib/domain";
import {
  Screen,
  Card,
  Title,
  Copy,
  Button,
  DataState,
  Pages,
  Notice,
} from "../../src/components/ui";
const labels: Record<string, string> = {
  access_approved: "Accès au carnet approuvé",
  care_recorded: "Nouvelle information enregistrée",
  care_corrected: "Information clinique corrigée ou retirée",
  appointment_updated: "Rendez-vous créé ou mis à jour",
  request_answered: "Réponse à votre demande",
  claim_rejected: "Demande d’accès refusée",
  access_revoked: "Un accès au carnet a été retiré",
  access_expired: "Un accès au carnet est arrivé à échéance",
};
export default function Updates() {
  const [page, setPage] = useState(1),
    view = useRpc<ParentUpdates>("parent_updates", { p_page: page }),
    action = useAction(),
    router = useRouter();
  return (
    <Screen
      title="Mes notifications"
      onRefresh={() => {
        void view.refresh();
      }}
      refreshing={view.loading}
    >
      <DataState
        loading={view.loading}
        error={view.error}
        onRetry={() => {
          void view.refresh();
        }}
      />
      {action.error && <Notice error>{action.error}</Notice>}
      {view.data && (
        <>
          <Copy>
            {view.data.unread_total} non consultées · {view.data.total}{" "}
            événements
          </Copy>
          <Copy muted>
            Ces actualités ne constituent pas des conseils médicaux. L’envoi
            automatique d’emails et les notifications push ne sont pas activés.
          </Copy>
          {view.data.unread_total > 0 && (
            <Button
              disabled={action.busy}
              onPress={() => {
                void action
                  .run("mark_parent_updates_read", {
                    p_read_through: view.data!.generated_at,
                  })
                  .then((v) => {
                    if (v) void view.refresh();
                  });
              }}
            >
              Marquer ces informations comme consultées
            </Button>
          )}
          {view.data.items.map((item) => (
            <Card key={item.kind + item.id}>
              <Title small>
                {labels[item.kind] ?? "Mise à jour du carnet"}
              </Title>
              {item.unread && <Copy>Nouveau</Copy>}
              <Copy muted>{instant(item.occurred_at)}</Copy>
              {item.child_id && (
                <Button
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/children/[id]",
                      params: { id: item.child_id! },
                    })
                  }
                >
                  Consulter le carnet
                </Button>
              )}
            </Card>
          ))}
          {!view.data.items.length && (
            <Card>
              <Copy>Aucune nouvelle information pour le moment.</Copy>
            </Card>
          )}
          <Pages
            page={page}
            more={page * 50 < view.data.total}
            onPage={setPage}
          />
        </>
      )}
    </Screen>
  );
}
