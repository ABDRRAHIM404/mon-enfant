import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
const light = {
  ink: "#12392f",
  muted: "#5d7268",
  teal: "#087f5b",
  paper: "#faf8f1",
  card: "#ffffff",
  pale: "#f2f4ef",
  line: "#dee6df",
  attention: "#fcece9",
  error: "#9e3427",
};
const dark = {
  ink: "#faf8f1",
  muted: "#b2c5bc",
  teal: "#31bc8c",
  paper: "#071c17",
  card: "#122e26",
  pale: "#193a30",
  line: "#315047",
  attention: "#48302f",
  error: "#ffd2c8",
};
type Mode = "system" | "light" | "dark";
const Context = createContext<{
  colors: typeof light;
  dark: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
} | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(),
    [mode, setState] = useState<Mode>("system");
  useEffect(() => {
    void AsyncStorage.getItem("mon-enfant.theme.v1").then((v) => {
      if (["system", "light", "dark"].includes(v ?? "")) setState(v as Mode);
    });
  }, []);
  const isDark = mode === "dark" || (mode === "system" && system === "dark");
  return (
    <Context.Provider
      value={{
        colors: isDark ? dark : light,
        dark: isDark,
        mode,
        setMode: (value) => {
          setState(value);
          void AsyncStorage.setItem("mon-enfant.theme.v1", value).catch(
            () => undefined,
          );
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTheme() {
  const value = useContext(Context);
  if (!value) throw new Error("ThemeProvider required");
  return value;
}
