import { useRouter } from "expo-router";
import { useRpc } from "../../src/lib/data";
import type { ParentWorkspaceData } from "../../src/lib/domain";
import { name, birth } from "../../src/lib/format";
import {
  Screen,
  Card,
  Title,
  Copy,
  Button,
  DataState,
} from "../../src/components/ui";
export default function Children() {
  const view = useRpc<ParentWorkspaceData>("parent_workspace"),
    router = useRouter();
  return (
    <Screen
      title="Mes enfants"
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
          {view.data.children.map((child) => (
            <Card key={child.id}>
              <Title small>{name(child)}</Title>
              <Copy muted>{birth(child)}</Copy>
              <Copy small>Identifiant permanent : {child.universal_id}</Copy>
              <Button
                onPress={() =>
                  router.push({
                    pathname: "/children/[id]",
                    params: { id: child.id },
                  })
                }
              >
                Consulter le carnet
              </Button>
            </Card>
          ))}
          {!view.data.children.length && (
            <Card>
              <Copy>
                Aucun carnet lié. L’invitation permet de demander un accès au
                carnet existant, sans créer un autre enfant.
              </Copy>
            </Card>
          )}
          <Button secondary onPress={() => router.push("/invitation")}>
            Présenter mon invitation
          </Button>
          {view.data.claims.length > 0 && (
            <Card>
              <Title small>Mes demandes d’accès</Title>
              {view.data.claims.map((claim) => (
                <Copy key={claim.id}>
                  {claim.state === "pending"
                    ? "En attente de vérification"
                    : claim.state === "approved"
                      ? "Demande approuvée"
                      : claim.state === "rejected"
                        ? "Demande refusée"
                        : "Demande annulée"}
                </Copy>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
