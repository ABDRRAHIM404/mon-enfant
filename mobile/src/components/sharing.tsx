import { useEffect, useState } from "react";
import { Share, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useRpc, useAction } from "../lib/data";
import { SITE, instant } from "../lib/format";
import { Card, Copy, Title, Button, Check, Notice, DataState } from "./ui";
type Scope = "vaccination_read" | "booklet_read";
type Item = {
  id: string;
  scope: Scope;
  expires_at: string;
  active: boolean;
  professional_id: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
};
type List = { items: Item[]; can_share: boolean };
type Receipt = {
  accepted: boolean;
  id: string;
  token: string;
  scope: Scope;
  expires_at: string;
  server_now: string;
};
const labels: Record<Scope, string> = {
  vaccination_read: "Vaccinations et références — suivi vaccinal",
  booklet_read: "Carnet — consultation",
};
export function ParentSharing({ childId }: { childId: string }) {
  const view = useRpc<List>("list_clinician_shares", { p_child_id: childId }),
    action = useAction(),
    [scope, setScope] = useState<Scope>("vaccination_read"),
    [consent, setConsent] = useState(false),
    [ticket, setTicket] = useState<(Receipt & { offset: number }) | null>(null),
    [seconds, setSeconds] = useState(0),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!ticket) return;
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil(
          (Date.parse(ticket.expires_at) - Date.now() - ticket.offset) / 1000,
        ),
      );
      setSeconds(left);
      if (!left) {
        setTicket(null);
        setMessage("Le code a expiré.");
        void view.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [ticket]);
  async function issue() {
    setMessage("");
    if (!consent) return;
    const r = await action.run<Receipt>("issue_clinician_share", {
      p_child_id: childId,
      p_scope: scope,
      p_consent: true,
    });
    if (r?.accepted && r.token) {
      setSeconds(
        Math.max(
          0,
          Math.ceil(
            (Date.parse(r.expires_at) - Date.parse(r.server_now)) / 1000,
          ),
        ),
      );
      setTicket({ ...r, offset: Date.parse(r.server_now) - Date.now() });
      setConsent(false);
      void view.refresh();
    } else if (r)
      setMessage(
        "Trop de créations rapprochées. Attendez dix minutes avant de réessayer.",
      );
  }
  async function revoke(id: string) {
    const r = await action.run("revoke_clinician_share", { p_share_id: id });
    if (r) {
      if (ticket?.id === id) setTicket(null);
      setMessage(
        "Partage révoqué. Le code et son accès temporaire ne sont plus utilisables.",
      );
      void view.refresh();
    }
  }
  return (
    <Card>
      <Title small>Partager le carnet</Title>
      <Copy>
        Un soignant vérifié peut lire les informations que vous choisissez, sans
        les modifier, pendant cinq minutes maximum.
      </Copy>
      <DataState
        loading={view.loading}
        error={view.error}
        onRetry={() => {
          void view.refresh();
        }}
      />
      {action.error && <Notice error>{action.error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {view.data && (
        <>
          {ticket ? (
            <>
              <Copy>{labels[ticket.scope]}</Copy>
              <Copy>
                Expire dans {Math.floor(seconds / 60)} min {seconds % 60} s
              </Copy>
              <View
                style={{
                  padding: 12,
                  backgroundColor: "#fff",
                  alignSelf: "center",
                  maxWidth: "100%",
                }}
                accessibilityLabel="QR de partage temporaire"
              >
                <QRCode
                  value={`${SITE}/share#share=${ticket.token}`}
                  size={220}
                  quietZone={8}
                />
              </View>
              <Copy small>
                Montrez ce code en privé au soignant choisi. Il ne contient ni
                identité ni information médicale.
              </Copy>
              <Button
                secondary
                onPress={() => {
                  void Share.share({
                    message: `${SITE}/share#share=${ticket.token}`,
                  }).catch(() =>
                    setMessage(
                      "Partage du lien indisponible. Vous pouvez montrer le QR.",
                    ),
                  );
                }}
              >
                Transmettre le lien temporaire
              </Button>
              <Button
                secondary
                disabled={action.busy}
                onPress={() => {
                  void revoke(ticket.id);
                }}
              >
                Révoquer ce code
              </Button>
            </>
          ) : (
            <>
              {Object.entries(labels).map(([value, label]) => (
                <Button
                  key={value}
                  disabled={!view.data?.can_share || action.busy}
                  secondary={scope !== value}
                  onPress={() => setScope(value as Scope)}
                >
                  {label}
                </Button>
              ))}
              <Check checked={consent} onChange={setConsent}>
                J’autorise un soignant vérifié à lire ces informations pendant
                cinq minutes maximum.
              </Check>
              <Button
                testID="sharing-create"
                disabled={!view.data.can_share || !consent || action.busy}
                onPress={() => {
                  void issue();
                }}
              >
                Afficher mon QR sécurisé
              </Button>
            </>
          )}
          {!view.data.can_share && (
            <Notice>
              Votre accès permet la lecture, mais pas la transmission du carnet.
              Contactez le professionnel responsable.
            </Notice>
          )}
          <Copy small muted>
            Code à usage unique, lié à la session du premier soignant vérifié
            qui le présente. Un nouveau code remplace le précédent code
            inutilisé. Le partage ne donne aucun droit de soins.
          </Copy>
          {view.data.items.length > 0 && (
            <Title small>Mes partages récents</Title>
          )}
          {view.data.items.map((item) => (
            <View key={item.id} style={{ gap: 8, paddingVertical: 8 }}>
              <Copy>{labels[item.scope]}</Copy>
              <Copy small>
                {item.active
                  ? item.consumed_at
                    ? `Ouvert par ${item.professional_id}`
                    : "En attente du soignant"
                  : item.revoked_at
                    ? "Révoqué"
                    : "Terminé ou indisponible"}{" "}
                · {instant(item.expires_at)}
              </Copy>
              {item.active && (
                <Button
                  secondary
                  disabled={action.busy}
                  onPress={() => {
                    void revoke(item.id);
                  }}
                >
                  Révoquer ce partage
                </Button>
              )}
            </View>
          ))}
        </>
      )}
    </Card>
  );
}
