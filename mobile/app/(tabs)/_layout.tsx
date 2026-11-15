import { Redirect, Tabs } from "expo-router";
import {
  House,
  Heart,
  CalendarDays,
  Bell,
  UserRound,
} from "lucide-react-native";
import { useAuth } from "../../src/auth/provider";
import { useTheme } from "../../src/components/theme";
import { Screen, DataState } from "../../src/components/ui";
export default function TabLayout() {
  const auth = useAuth(),
    { colors } = useTheme();
  if (auth.loading)
    return (
      <Screen>
        <DataState loading error="" onRetry={() => {}} />
      </Screen>
    );
  if (!auth.session) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
      }}
    >
      {[
        { name: "index", title: "Accueil", Icon: House },
        { name: "children", title: "Enfants", Icon: Heart },
        { name: "calendar", title: "Rendez-vous", Icon: CalendarDays },
        { name: "updates", title: "Messages", Icon: Bell },
        { name: "settings", title: "Compte", Icon: UserRound },
      ].map(({ name, title, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => <Icon size={24} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
