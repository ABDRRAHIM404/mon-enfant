import { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNativeView, useRpc, useAction } from "../../../src/lib/data";
import type { ParentBooklet } from "../../../src/lib/domain";
import { instant } from "../../../src/lib/format";
import {
  Screen,
  Card,
  Copy,
  Title,
  Button,
  DataState,
  Pages,
  Notice,
} from "../../../src/components/ui";
import { ParentSharing } from "../../../src/components/sharing";
type History = {
  items: {
    id: string;
    occurred_at: string;
    entity_type: string;
    actor_type: string;
    professional_id: string | null;
  }[];
  total: number;
  since: string;
};
const labels: Record<string, string> = {
  guardian_share_issued: "Création d’un partage temporaire",
  guardian_share_redeemed: "Ouverture d’un partage par un soignant",
  guardian_share_read: "Lecture temporaire autorisée",
  guardian_share_revoked: "Révocation d’un partage temporaire",
  guardian_booklet_read: "Consultation du carnet",
  guardian_booklet_export: "Export du carnet",
  guardian_calendar_read: "Consultation du calendrier",
  guardian_vaccine_references_read: "Consultation des références vaccinales",
  clinical_timeline_read: "Consultation du dossier clinique",
  child_profile_read: "Consultation de l’identité",
  guardian_access_history_read: "Consultation de l’historique des accès",
};
export default function Privacy() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    [page, setPage] = useState(1),
    booklet = useNativeView<ParentBooklet>("booklet", {
      p_child_id: id,
      p_page: 1,
    }),
    history = useRpc<History>("parent_access_history", {
      p_child_id: id,
      p_page: page,
    }),
    action = useAction(),
    router = useRouter();
  return (
    <Screen back title="Accès et confidentialité">
      <DataState
        loading={booklet.loading || history.loading}
        error={booklet.error || history.error}
        onRetry={() => {
          void booklet.refresh();
          void history.refresh();
        }}
      />
      {booklet.data && history.data && (
        <>
          <Card>
            <Title small>Mon lien avec ce carnet</Title>
            <Copy>
              Accès vérifié jusqu’au {instant(booklet.data.link.expires_at)}
            </Copy>
            <Copy>
              {booklet.data.link.can_export
                ? "Transmission et export explicitement autorisés."
                : "Lecture autorisée, sans export ni transmission."}
            </Copy>
            <Copy>
              Un QR d’identification ne donne aucun accès au dossier. Les accès
              temporaires sont limités à leur motif et à leur échéance.
            </Copy>
          </Card>
          <ParentSharing key={id} childId={id} />
          <Title small>Historique des consultations</Title>
          <Copy small muted>
            Depuis le début de votre lien actuel. Les entrées ne contiennent pas
            le contenu médical consulté.
          </Copy>
          {history.data.items.map((item) => (
            <Card key={item.id}>
              <Copy>
                {labels[item.entity_type] ??
                  "Opération autorisée sur le carnet"}
              </Copy>
              <Copy small muted>
                {instant(item.occurred_at)} ·{" "}
                {item.actor_type === "self"
                  ? "Vous"
                  : item.actor_type === "professional"
                    ? `Professionnel ${item.professional_id ?? ""}`
                    : "Responsable autorisé"}
              </Copy>
            </Card>
          ))}
          <Pages
            page={page}
            more={page * 50 < history.data.total}
            onPage={setPage}
          />
          {action.error && <Notice error>{action.error}</Notice>}
          <Card attention>
            <Title small>Retirer mon accès</Title>
            <Copy>
              La révocation coupe aussi les partages temporaires que vous avez
              émis avec ce lien. Une nouvelle vérification sera nécessaire pour
              retrouver l’accès.
            </Copy>
            <Button
              secondary
              disabled={action.busy}
              onPress={() =>
                Alert.alert(
                  "Retirer votre accès à ce carnet ?",
                  "Cette action ferme votre lien et vos partages temporaires.",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Révoquer mon accès",
                      style: "destructive",
                      onPress: () => {
                        void action
                          .run("revoke_guardian_link", {
                            p_id: booklet.data!.link.id,
                            p_reason:
                              "Révocation demandée par le responsable depuis son application parent.",
                          })
                          .then((v) => {
                            if (v) router.replace("/(tabs)/children");
                          });
                      },
                    },
                  ],
                )
              }
            >
              Révoquer mon accès
            </Button>
          </Card>
        </>
      )}
    </Screen>
  );
}
