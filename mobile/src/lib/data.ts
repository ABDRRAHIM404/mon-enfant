import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../auth/provider";
export function rpcError(code?: string) {
  return code === "42501"
    ? "Accès indisponible ou révoqué. Actualisez vos liens ou reconnectez-vous."
    : code === "PT409"
      ? "La demande a changé. Actualisez avant de réessayer."
      : code === "54000"
        ? "La limite interactive est dépassée. Contactez le professionnel."
        : "Connexion nécessaire. Les informations n’ont pas pu être vérifiées.";
}
export function useRpc<T>(name: string, args: Record<string, unknown> = {}) {
  const { client, session, foreground, epoch } = useAuth(),
    key = JSON.stringify(args),
    generation = useRef(0);
  const scope = `${session?.user.id}:${epoch}:${name}:${key}`;
  const [state, setState] = useState<{
    scope: string;
    data: T | null;
    loading: boolean;
    error: string;
  }>({ scope: "", data: null, loading: true, error: "" });
  const refresh = useCallback(
    async (clear = true) => {
      const attempt = ++generation.current;
      setState((previous) =>
        clear || previous.scope !== scope
          ? { scope, data: null, loading: true, error: "" }
          : previous,
      );
      if (!client || !session || !foreground) {
        setState({ scope, data: null, loading: false, error: "" });
        return;
      }
      try {
        const { data, error } = await client
          .rpc(name, JSON.parse(key))
          .setHeader("Authorization", `Bearer ${session.access_token}`);
        if (attempt !== generation.current) return;
        setState(
          error
            ? { scope, data: null, loading: false, error: rpcError(error.code) }
            : { scope, data: data as T, loading: false, error: "" },
        );
      } catch {
        if (attempt === generation.current)
          setState({ scope, data: null, loading: false, error: rpcError() });
      }
    },
    [client, session, foreground, name, key, scope],
  );
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = foreground
        ? setInterval(() => {
            void refresh(false);
          }, 30000)
        : null;
      return () => {
        generation.current++;
        if (timer) clearInterval(timer);
      };
    }, [refresh, foreground]),
  );
  return {
    ...state,
    data: foreground && session && state.scope === scope ? state.data : null,
    loading: state.scope !== scope || state.loading,
    error: state.scope === scope ? state.error : "",
    refresh: () => refresh(true),
  };
}
export function useAction() {
  const { client, session } = useAuth(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run<T>(
    name: string,
    args: Record<string, unknown>,
    success?: string,
  ): Promise<T | null> {
    if (!client || !session || lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error } = await client
        .rpc(name, args)
        .setHeader("Authorization", `Bearer ${session.access_token}`);
      if (error) {
        setError(rpcError(error.code));
        return null;
      }
      if (success) setMessage(success);
      return (data ?? true) as T;
    } catch {
      setError(rpcError());
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    error,
    message,
    clear: () => {
      setError("");
      setMessage("");
    },
  };
}

type NativeKind =
  | "home"
  | "booklet"
  | "calendar"
  | "vaccine_references"
  | "vaccination_history";
type NativeArgs = {
  p_child_id: string | null;
  p_page?: number;
  p_from?: string;
  p_to?: string;
};
export function useNativeView<T>(
  kind: "home",
  args?: { p_page?: number },
): ReturnType<typeof useRpc<T>>;
export function useNativeView<T>(
  kind: Exclude<NativeKind, "home">,
  args: NativeArgs,
): ReturnType<typeof useRpc<T>>;
export function useNativeView<T>(
  kind: NativeKind,
  args: Record<string, unknown> = {},
) {
  return useRpc<T>("parent_mobile_view", { ...args, p_kind: kind });
}
