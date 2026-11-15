import { useState } from "react";
import { Share, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRpc, useAction } from "../../../src/lib/data";
import type { ParentBooklet } from "../../../src/lib/domain";
import { name, birth, uuid } from "../../../src/lib/format";
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
import { Entry, Growth } from "../../../src/components/clinical";
import { Appointment } from "../../../src/components/appointment";
export default function Booklet() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    [page, setPage] = useState(1),
    [section, setSection] = useState("records"),
    view = useRpc<ParentBooklet>("parent_mobile_view", {
      p_kind: "booklet",
      p_child_id: uuid.test(id ?? "") ? id : null,
      p_page: page,
    }),
    action = useAction(),
    router = useRouter();
  async function exportBooklet() {
    const result = await action.run<Record<string, unknown>>(
      "parent_child_export",
      { p_child_id: id },
    );
    if (!result) return;
    try {
      await Share.share({
        title: "Carnet Mon Enfant",
        message: JSON.stringify(result, null, 2),
      });
    } catch {
      Alert.alert(
        "Export non partagé",
        "Le partage a été annulé ou n’est pas disponible.",
      );
    }
  }
  return (
    <Screen
      back
      title={view.data ? name(view.data.child) : "Carnet de mon enfant"}
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
          <Copy muted>{birth(view.data.child)}</Copy>
          <Copy small>
            Identifiant permanent : {view.data.child.universal_id}
          </Copy>
          <Button
            secondary
            onPress={() =>
              router.push({
                pathname: "/children/[id]/vaccinations",
                params: { id },
              })
            }
          >
            Vaccinations et partage temporaire
          </Button>
          <Button
            secondary
            onPress={() =>
              router.push({
                pathname: "/children/[id]/privacy",
                params: { id },
              })
            }
          >
            Accès et confidentialité
          </Button>
          <Button
            secondary
            onPress={() =>
              router.push({
                pathname: "/children/[id]/requests",
                params: { id },
              })
            }
          >
            Demander une vérification
          </Button>
          <Card>
            <Title small>Consulter le carnet</Title>
            {[
              ["records", "Soins et historique"],
              ["growth", "Croissance"],
              ["appointments", "Rendez-vous"],
            ].map(([value, label]) => (
              <Button
                key={value}
                secondary={section !== value}
                onPress={() => setSection(value)}
              >
                {label}
              </Button>
            ))}
          </Card>
          {section === "records" &&
            (view.data.entries.length ? (
              view.data.entries.map((entry) => (
                <Entry key={entry.id} entry={entry} />
              ))
            ) : (
              <Card>
                <Copy>
                  Aucun soin enregistré sur cette page. Les informations
                  absentes restent inconnues.
                </Copy>
              </Card>
            ))}
          {section === "growth" && (
            <>
              <Growth
                entries={view.data.growth}
                field="weight_kg"
                label="Poids"
                unit="kg"
              />
              <Growth
                entries={view.data.growth}
                field="height_cm"
                label="Taille"
                unit="cm"
              />
              <Growth
                entries={view.data.growth}
                field="head_cm"
                label="Périmètre crânien"
                unit="cm"
              />
            </>
          )}
          {section === "appointments" &&
            (view.data.appointments.length ? (
              view.data.appointments.map((item) => (
                <Appointment key={item.id} item={item} />
              ))
            ) : (
              <Card>
                <Copy>Aucun rendez-vous enregistré sur cette page.</Copy>
              </Card>
            ))}
          <Pages
            page={page}
            more={
              page * 30 <
              Math.max(view.data.entry_total, view.data.appointment_total)
            }
            onPage={setPage}
          />
          {action.error && <Notice error>{action.error}</Notice>}
          {view.data.link.can_export && (
            <Card>
              <Title small>Exporter le carnet</Title>
              <Copy>
                Une copie peut contenir des informations de santé. Choisissez
                uniquement une destination de confiance ; sa protection dépend
                ensuite de cette destination.
              </Copy>
              <Button
                secondary
                disabled={action.busy}
                onPress={() =>
                  Alert.alert(
                    "Partager une copie du carnet ?",
                    "Cette action exporte les informations autorisées et leur provenance.",
                    [
                      { text: "Annuler", style: "cancel" },
                      {
                        text: "Exporter",
                        onPress: () => {
                          void exportBooklet();
                        },
                      },
                    ],
                  )
                }
              >
                Exporter une copie autorisée
              </Button>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
