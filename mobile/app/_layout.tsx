import { Stack } from "expo-router";
import { View, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth/provider";
import { ThemeProvider, useTheme } from "../src/components/theme";
import { Screen, Button, Notice } from "../src/components/ui";
import { StatusBar } from "expo-status-bar";
function Root() {
  const auth = useAuth(),
    { dark, colors } = useTheme();
  const hidden = (!auth.foreground && !!auth.session) || auth.logoutPending;
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Protected guard={!!auth.session}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="children" />
            <Stack.Screen name="invitation" />
          </Stack.Protected>
        </Stack>
      </View>
      {hidden && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }]}
        >
          <Screen title={auth.logoutPending ? "Déconnexion" : "Mon Enfant"}>
            <Notice error={auth.logoutPending}>
              {auth.logoutPending
                ? auth.error || "Fermeture de votre session…"
                : "Les informations du carnet sont masquées pendant que l’application est en arrière-plan."}
            </Notice>
            {auth.logoutPending && (
              <Button
                onPress={() => {
                  void auth.signOut();
                }}
              >
                Réessayer la déconnexion
              </Button>
            )}
          </Screen>
        </View>
      )}
    </View>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
