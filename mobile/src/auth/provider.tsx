import "react-native-url-polyfill/auto";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  createClient,
  processLock,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { prepareAuthStorage } from "./storage";
type Auth = {
  client: SupabaseClient | null;
  session: Session | null;
  loading: boolean;
  foreground: boolean;
  epoch: number;
  error: string;
  logoutPending: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const configured =
  URL.startsWith("https://") && KEY.startsWith("sb_publishable_");
export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [foreground, setForeground] = useState(AppState.currentState === "active"),
    [epoch, setEpoch] = useState(0),
    [error, setError] = useState(""),
    [logoutPending, setLogoutPending] = useState(false);
  const controller = useRef<Awaited<
    ReturnType<typeof prepareAuthStorage>
  > | null>(null);
  useEffect(() => {
    let current = true,
      cleanup = () => {};
    async function init() {
      if (!configured) {
        setError(
          "La connexion sécurisée de cette version n’est pas configurée.",
        );
        setLoading(false);
        return;
      }
      const ref = new globalThis.URL(URL).hostname.split(".")[0],
        key = `sb-${ref}-auth-token`;
      const store = await prepareAuthStorage(key);
      if (!current) return;
      controller.current = store;
      const api = createClient(URL, KEY, {
        global: {
          fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
        },
        auth: {
          storage: store.storage,
          storageKey: key,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          lock: processLock,
        },
      });
      const {
        data: { subscription },
      } = api.auth.onAuthStateChange((_event, value) => {
        if (current) setSession(value);
      });
      setClient(api);
      cleanup = () => {
        subscription.unsubscribe();
        api.auth.stopAutoRefresh();
      };
      const { data, error } = await api.auth.getSession();
      if (!current) return;
      if (error) setError("Session indisponible. Connectez-vous à nouveau.");
      else setSession(data.session);
      setLoading(false);
    }
    void init().catch(() => {
      if (current) {
        setError(
          "Le stockage sécurisé est indisponible. Réessayez avant de vous connecter.",
        );
        setLoading(false);
      }
    });
    return () => {
      current = false;
      cleanup();
    };
  }, []);
  useEffect(() => {
    if (!client) return;
    const active = AppState.currentState === "active";
    setForeground(active);
    if (active) client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
    const sub = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      setForeground(active);
      setEpoch((value) => value + 1);
      if (active) client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, [client]);
  async function signIn(email: string, password: string, remember: boolean) {
    if (!client || !controller.current)
      throw new Error("Connexion sécurisée indisponible.");
    setError("");
    await controller.current.setRemember(remember);
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error)
      throw new Error(
        "Connexion refusée. Vérifiez vos identifiants et la confirmation de votre adresse.",
      );
  }
  async function signOut() {
    if (!client) return;
    setLogoutPending(true);
    setError("");
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      await controller.current?.clear();
      setSession(null);
      setLogoutPending(false);
    } catch {
      setError(
        "Déconnexion serveur non confirmée. Les informations sont masquées. Vérifiez votre connexion puis réessayez.",
      );
    }
  }
  return (
    <Context.Provider
      value={{
        client,
        session,
        loading,
        foreground,
        epoch,
        error,
        logoutPending,
        signIn,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider required");
  return value;
}
