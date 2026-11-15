import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/provider";
import { Screen, DataState } from "../src/components/ui";
export default function Index() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <Screen>
        <DataState loading error="" onRetry={() => {}} />
      </Screen>
    );
  return <Redirect href={auth.session ? "/(tabs)" : "/login"} />;
}
