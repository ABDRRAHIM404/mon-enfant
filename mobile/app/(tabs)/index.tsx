import { useState } from "react";
import { useRouter } from "expo-router";
import { useRpc, useAction } from "../../src/lib/data";
import type {
  ParentWorkspaceData,
  NativeAppointment,
} from "../../src/lib/domain";
import { name, birth } from "../../src/lib/format";
import {
  Screen,
  Card,
  Copy,
  Title,
  Button,
  DataState,
  Field,
  Notice,
} from "../../src/components/ui";
type Home = ParentWorkspaceData & {
  next_appointment: NativeAppointment | null;
  unread_total: number;
  server_day: string;
};
export default function Home() {
  const view = useRpc<Home>("parent_mobile_view", { p_kind: "home" }),
    router = useRouter(),
    action = useAction(),
    [display, setDisplay] = useState("");
  return (
    <Screen
      title={
        view.data?.profile
          ? `Bonjour ${view.data.profile.display_name}`
          : "Bienvenue dans votre espace parent"
      }
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
      {view.data && (
        <>
          {!view.data.profile ? (
            <Card>
              <Title small>Activer mon espace parent</Title>
              <Copy>
                Ce profil ne donne aucun accès à un carnet avant la vérification
                du lien parental.
              </Copy>
              <Field
                label="Votre nom d’affichage"
                value={display}
                onChangeText={setDisplay}
                maxLength={120}
              />
              {action.error && <Notice error>{action.error}</Notice>}
              <Button
                disabled={action.busy || display.trim().length < 2}
                onPress={() => {
                  void action
                    .run("save_parent_profile", { p_display_name: display })
                    .then((v) => {
                      if (v) void view.refresh();
                    });
                }}
              >
                Enregistrer mon profil
              </Button>
            </Card>
          ) : (
            <>
              <Title small>Mes enfants</Title>
              {view.data.children.length ? (
                view.data.children.map((child) => (
                  <Card key={child.id}>
                    <Title small>{name(child)}</Title>
                    <Copy muted>{birth(child)}</Copy>
                    <Copy small muted>
                      Accès lié vérifié · lecture du carnet
                    </Copy>
                    <Button
                      onPress={() =>
                        router.push({
                          pathname: "/children/[id]",
                          params: { id: child.id },
                        })
                      }
                    >
                      Ouvrir le carnet
                    </Button>
                  </Card>
                ))
              ) : (
                <Card>
                  <Copy>
                    Aucun carnet lié pour le moment. Demandez une invitation au
                    professionnel responsable.
                  </Copy>
                </Card>
              )}
              <Card>
                <Title small>Prochain rendez-vous</Title>
                {view.data.next_appointment ? (
                  <>
                    <Copy>{view.data.next_appointment.purpose_label}</Copy>
                    <Copy>{view.data.next_appointment.starts_display}</Copy>
                    <Copy muted>
                      {view.data.next_appointment.facility_name}
                    </Copy>
                    <Button
                      secondary
                      onPress={() => router.push("/(tabs)/calendar")}
                    >
                      Voir les rendez-vous
                    </Button>
                  </>
                ) : (
                  <Copy muted>Aucun rendez-vous à venir enregistré.</Copy>
                )}
              </Card>
              <Card>
                <Title small>Mises à jour</Title>
                <Copy>
                  {view.data.unread_total} nouvelle(s) information(s) à
                  consulter.
                </Copy>
                <Button
                  secondary
                  onPress={() => router.push("/(tabs)/updates")}
                >
                  Consulter les notifications
                </Button>
              </Card>
              <Button secondary onPress={() => router.push("/invitation")}>
                J’ai reçu une invitation
              </Button>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
