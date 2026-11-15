import { useState } from "react";
import { Alert, Linking } from "react-native";
import { useAuth } from "../../src/auth/provider";
import { useTheme } from "../../src/components/theme";
import { useAction, useRpc } from "../../src/lib/data";
import type { ParentWorkspaceData } from "../../src/lib/domain";
import {
  Screen,
  Card,
  Copy,
  Title,
  Button,
  Field,
  Notice,
  DataState,
} from "../../src/components/ui";
import { SITE } from "../../src/lib/format";
export default function Settings() {
  const auth = useAuth(),
    theme = useTheme(),
    view = useRpc<ParentWorkspaceData>("parent_workspace"),
    action = useAction(),
    [display, setDisplay] = useState("");
  return (
    <Screen title="Mon compte">
      <Copy muted>{auth.session?.user.email}</Copy>
      <DataState
        loading={view.loading}
        error={view.error}
        onRetry={() => {
          void view.refresh();
        }}
      />
      {view.data && (
        <Card>
          <Title small>Profil parent</Title>
          <Copy>{view.data.profile?.display_name ?? "Profil non activé"}</Copy>
          <Field
            label="Nom d’affichage"
            value={display}
            onChangeText={setDisplay}
            maxLength={120}
          />
          {action.error && <Notice error>{action.error}</Notice>}
          {action.message && <Notice>{action.message}</Notice>}
          <Button
            disabled={action.busy || display.trim().length < 2}
            onPress={() => {
              void action
                .run(
                  "save_parent_profile",
                  { p_display_name: display },
                  "Votre profil parent est enregistré.",
                )
                .then((v) => {
                  if (v) {
                    setDisplay("");
                    void view.refresh();
                  }
                });
            }}
          >
            Enregistrer mon profil
          </Button>
          <Copy small muted>
            Ce nom d’affichage ne prouve ni l’identité, ni l’autorité parentale.
            Le lien avec chaque carnet est vérifié séparément.
          </Copy>
        </Card>
      )}
      <Card>
        <Title small>Apparence</Title>
        {[
          ["system", "Selon l’appareil"],
          ["light", "Clair"],
          ["dark", "Sombre"],
        ].map(([mode, label]) => (
          <Button
            key={mode}
            secondary={theme.mode !== mode}
            onPress={() => theme.setMode(mode as "system" | "light" | "dark")}
          >
            {label}
          </Button>
        ))}
      </Card>
      <Card>
        <Title small>Confidentialité</Title>
        <Copy>
          Les informations des carnets sont vérifiées en ligne et ne sont pas
          enregistrées hors ligne sur cet appareil. Une session mémorisée est
          conservée dans le stockage sécurisé de l’appareil.
        </Copy>
        <Copy>
          Les préférences de thème ne contiennent aucune information clinique.
        </Copy>
        <Button
          secondary
          onPress={() => {
            void Linking.openURL(SITE + "/forgot-password");
          }}
        >
          Changer ou récupérer mon mot de passe
        </Button>
      </Card>
      <Button
        testID="logout"
        secondary
        onPress={() =>
          Alert.alert(
            "Se déconnecter ?",
            "La session de cette application sera fermée. Les autres appareils restent connectés.",
            [
              { text: "Annuler", style: "cancel" },
              {
                text: "Se déconnecter",
                style: "destructive",
                onPress: () => {
                  void auth.signOut();
                },
              },
            ],
          )
        }
      >
        Se déconnecter
      </Button>
    </Screen>
  );
}
