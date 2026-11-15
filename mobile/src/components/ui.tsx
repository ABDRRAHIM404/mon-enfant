import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useTheme } from "./theme";
export function Copy({
  children,
  muted = false,
  small = false,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  small?: boolean;
  style?: StyleProp<import("react-native").TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          fontSize: small ? 13 : 16,
          lineHeight: small ? 20 : 25,
          color: muted ? colors.muted : colors.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Title({
  children,
  small = false,
}: {
  children: ReactNode;
  small?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontSize: small ? 23 : 32,
        fontWeight: "700",
        lineHeight: small ? 30 : 39,
        color: colors.ink,
        flexShrink: 1,
      }}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  attention = false,
  style,
}: {
  children: ReactNode;
  attention?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: attention ? colors.attention : colors.card,
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: 22,
          padding: 20,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  children,
  onPress,
  disabled = false,
  secondary = false,
  testID,
}: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  const { colors, dark } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: secondary ? colors.card : colors.teal,
        borderColor: secondary ? colors.line : colors.teal,
        borderWidth: 1,
        minHeight: 48,
        borderRadius: 15,
        paddingHorizontal: 17,
        paddingVertical: 13,
        justifyContent: "center",
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: secondary ? colors.ink : dark ? "#071c17" : "#fff",
          fontWeight: "700",
          fontSize: 16,
          textAlign: "center",
          flexShrink: 1,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Copy style={{ fontWeight: "600" }}>{label}</Copy>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          {
            backgroundColor: colors.card,
            color: colors.ink,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: 12,
            padding: 13,
            fontSize: 16,
            minHeight: 48,
            textAlignVertical: props.multiline ? "top" : "center",
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
      }}
    >
      <View
        style={{
          borderColor: colors.teal,
          borderWidth: 2,
          borderRadius: 5,
          width: 24,
          height: 24,
          backgroundColor: checked ? colors.teal : colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>
          {checked ? "✓" : ""}
        </Text>
      </View>
      <Copy style={{ flex: 1 }}>{children}</Copy>
    </Pressable>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={{
        padding: 15,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 14,
        backgroundColor: colors.pale,
      }}
    >
      <Copy style={error ? { color: colors.error } : undefined}>
        {children}
      </Copy>
    </View>
  );
}
export function Brand() {
  const { dark } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image
        accessibilityLabel="Emblème Mon Enfant"
        source={
          dark
            ? require("../../assets/logo-symbol-dark.png")
            : require("../../assets/logo-symbol-light.png")
        }
        style={{ width: 46, height: 46 }}
        resizeMode="contain"
      />
      <View>
        <Title small>mon enfant</Title>
        <Copy small muted>
          Le carnet qui grandit avec lui
        </Copy>
      </View>
    </View>
  );
}
export function Screen({
  title,
  children,
  back = false,
  onRefresh,
  refreshing = false,
}: {
  title?: string;
  children: ReactNode;
  back?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { colors } = useTheme(),
    insets = useSafeAreaInsets(),
    router = useRouter();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        paddingTop: insets.top + 14,
        paddingBottom: insets.bottom + 36,
        paddingHorizontal: 20,
        gap: 22,
        maxWidth: 900,
        width: "100%",
        alignSelf: "center",
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
          />
        ) : undefined
      }
    >
      <Brand />
      {back && (
        <Button
          secondary
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
        >
          Retour
        </Button>
      )}
      {title && <Title>{title}</Title>}
      {children}
      <Copy small muted>
        Environnement de développement · Données fictives uniquement
      </Copy>
    </ScrollView>
  );
}
export function DataState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return loading ? (
    <View style={styles.loading}>
      <ActivityIndicator />
      <Copy muted>Vérification de votre accès…</Copy>
    </View>
  ) : error ? (
    <Card>
      <Notice error>{error}</Notice>
      <Button secondary onPress={onRetry}>
        Réessayer
      </Button>
    </Card>
  ) : null;
}
export function Pages({
  page,
  more,
  onPage,
}: {
  page: number;
  more: boolean;
  onPage: (v: number) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Copy muted>Page {page}</Copy>
      {page > 1 && (
        <Button secondary onPress={() => onPage(page - 1)}>
          Page précédente
        </Button>
      )}
      {more && (
        <Button secondary onPress={() => onPage(page + 1)}>
          Page suivante
        </Button>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  loading: { padding: 24, gap: 12, alignItems: "center" },
});
