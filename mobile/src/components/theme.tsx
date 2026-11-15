import { createContext, useContext, type ReactNode } from "react";
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
const appearance = { colors: light, dark: false };
const Context = createContext<typeof appearance | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={appearance}>{children}</Context.Provider>;
}
export function useTheme() {
  const value = useContext(Context);
  if (!value) throw new Error("ThemeProvider required");
  return value;
}
