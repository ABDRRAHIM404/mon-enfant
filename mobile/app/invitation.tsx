import { useCallback, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { useAuth } from "../src/auth/provider";
import { useAction, useRpc } from "../src/lib/data";
import type { ParentWorkspaceData } from "../src/lib/domain";
import { invitationToken } from "../src/lib/format";
import {
  Screen,
  Card,
  Copy,
  Button,
  Field,
  Check,
  Notice,
  DataState,
} from "../src/components/ui";
export default function Invitation() {
  const { foreground } = useAuth(),
    view = useRpc<ParentWorkspaceData>("parent_workspace"),
    action = useAction(),
    router = useRouter(),
    [permission, requestPermission] = useCameraPermissions(),
    [scan, setScan] = useState(false),
    [code, setCode] = useState(""),
    [relationship, setRelationship] = useState("mother"),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    operation = useRef<{ payload: string; id: string } | null>(null);
  useFocusEffect(useCallback(() => () => setScan(false), [foreground]));
  async function claim() {
    const token = invitationToken(code);
    if (!token || !consent) {
      setError("Présentez une invitation valide et confirmez votre demande.");
      return;
    }
    setError("");
    const payload = JSON.stringify({ token, relationship, consent });
    if (operation.current?.payload !== payload)
      operation.current = { payload, id: Crypto.randomUUID() };
    const result = await action.run("claim_guardian_invitation", {
      p_operation_id: operation.current.id,
      p_token: token,
      p_relationship: relationship,
      p_consent: true,
    });
    if (result) {
      setDone(true);
      setCode("");
      operation.current = null;
    }
  }
  return (
    <Screen back title="Mon invitation">
      <Copy>
        Votre invitation demande le lien avec un carnet existant. Aucun dossier
        n’est accessible avant la vérification par le professionnel.
      </Copy>
      <DataState
        loading={view.loading}
        error={view.error}
        onRetry={() => {
          void view.refresh();
        }}
      />
      {view.data && !view.data.profile ? (
        <Card>
          <Copy>
            Activez d’abord votre profil parent, puis revenez présenter votre
            invitation.
          </Copy>
          <Button onPress={() => router.push("/(tabs)/settings")}>
            Activer mon profil
          </Button>
        </Card>
      ) : (
        view.data && (
          <Card>
            {done ? (
              <>
                <Notice>
                  Votre demande est enregistrée. Le professionnel doit vérifier
                  votre identité et votre lien avec l’enfant avant d’autoriser
                  l’accès.
                </Notice>
                <Button onPress={() => router.replace("/(tabs)/children")}>
                  Consulter mes demandes
                </Button>
              </>
            ) : (
              <>
                {error && <Notice error>{error}</Notice>}
                {action.error && <Notice error>{action.error}</Notice>}
                <Field
                  label="Code ou lien de l’invitation"
                  testID="invitation-token"
                  value={code}
                  onChangeText={setCode}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={512}
                />
                <Button
                  secondary
                  onPress={() => {
                    if (permission?.granted) setScan(true);
                    else
                      void requestPermission().then((p) => {
                        if (p.granted) setScan(true);
                        else
                          setError(
                            "Autorisez la caméra dans les réglages, ou collez votre invitation.",
                          );
                      });
                  }}
                >
                  Scanner le QR d’invitation
                </Button>
                {permission &&
                  !permission.canAskAgain &&
                  !permission.granted && (
                    <Button
                      secondary
                      onPress={() => {
                        void Linking.openSettings();
                      }}
                    >
                      Ouvrir les réglages de la caméra
                    </Button>
                  )}
                {scan && foreground && (
                  <View style={{ gap: 12 }}>
                    <CameraView
                      style={{ height: 260, borderRadius: 16 }}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                      onBarcodeScanned={(result) => {
                        const token = invitationToken(result.data);
                        setScan(false);
                        if (token) {
                          setCode(token);
                          setError("");
                        } else
                          setError(
                            "Ce QR n’est pas une invitation de cette application.",
                          );
                      }}
                    />
                    <Button secondary onPress={() => setScan(false)}>
                      Arrêter la caméra
                    </Button>
                  </View>
                )}
                <Copy>Lien déclaré avec l’enfant</Copy>
                {[
                  ["mother", "Mère"],
                  ["father", "Père"],
                  ["legal_guardian", "Responsable légal"],
                  ["other", "Autre lien à vérifier"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    secondary={relationship !== value}
                    onPress={() => setRelationship(value)}
                  >
                    {label}
                  </Button>
                ))}
                <Check checked={consent} onChange={setConsent}>
                  Je demande l’accès à ce carnet et consens à la vérification de
                  mon identité et de mon lien avec l’enfant.
                </Check>
                <Button
                  testID="invitation-submit"
                  disabled={action.busy || !code || !consent}
                  onPress={() => {
                    void claim();
                  }}
                >
                  Envoyer ma demande de lien
                </Button>
                <Copy small muted>
                  Le code reste uniquement dans cette page et n’est jamais
                  enregistré sur l’appareil. Le QR ne donne pas directement
                  accès au carnet.
                </Copy>
              </>
            )}
          </Card>
        )
      )}
    </Screen>
  );
}
