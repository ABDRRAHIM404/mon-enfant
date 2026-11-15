import { useState } from "react";
import { Image, Linking, Platform } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/provider";
import {
  Button,
  Card,
  Check,
  Copy,
  Field,
  Notice,
  Screen,
  Title,
  DataState,
} from "../src/components/ui";
import { SITE } from "../src/lib/format";
export default function Login() {
  const auth = useAuth(),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [remember, setRemember] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (auth.session) return <Redirect href="/(tabs)" />;
  async function submit() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await auth.signIn(email, password, remember);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion indisponible.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Screen>
      <Image
        source={require("../assets/family-illustration.png")}
        resizeMode="contain"
        style={{ height: 180, width: "100%" }}
        accessibilityLabel="Illustration d’une famille"
      />
      <Title>Le carnet de votre enfant, près de vous.</Title>
      <Copy muted>
        Consultez les informations enregistrées par ses professionnels, ses
        rendez-vous et ses mises à jour.
      </Copy>
      <Card>
        <Title small>Connexion parent</Title>
        {auth.error && <Notice error>{auth.error}</Notice>}
        {error && <Notice error>{error}</Notice>}
        {auth.loading ? (
          <DataState loading error="" onRetry={() => {}} />
        ) : (
          <>
            <Field
              label="Adresse email"
              testID="login-email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              label="Mot de passe"
              testID="login-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
            {Platform.OS !== "web" && (
              <Check checked={remember} onChange={setRemember}>
                Rester connecté sur cet appareil personnel
              </Check>
            )}
            <Button
              testID="login-submit"
              disabled={pending || !auth.client || !email || !password}
              onPress={() => {
                void submit();
              }}
            >
              {pending ? "Connexion…" : "Se connecter"}
            </Button>
          </>
        )}
      </Card>
      <Button
        secondary
        onPress={() => {
          void Linking.openURL(SITE + "/signup");
        }}
      >
        Créer un compte
      </Button>
      <Button
        secondary
        onPress={() => {
          void Linking.openURL(SITE + "/forgot-password");
        }}
      >
        Mot de passe oublié
      </Button>
      <Copy small muted>
        La création du compte et la récupération du mot de passe s’ouvrent sur
        le site sécurisé. Revenez ensuite ici pour vous connecter.
      </Copy>
    </Screen>
  );
}
