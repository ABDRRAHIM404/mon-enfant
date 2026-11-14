"use client";
import { useSyncExternalStore } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
type Theme = "system" | "light" | "dark";
const key = "mon-enfant-theme";
let volatileTheme: Theme | undefined;
function snapshot(): Theme {
  if (volatileTheme) return volatileTheme;
  try {
    const saved = localStorage.getItem(key);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return volatileTheme ?? "system";
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("mon-enfant-theme", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("mon-enfant-theme", listener);
  };
}
function apply(preference: Theme) {
  const resolved =
    preference === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}
export function ThemeControl() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    snapshot,
    () => "system",
  );
  const next =
    theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const labels = { system: "système", light: "clair", dark: "sombre" };
  const Icon = theme === "system" ? Laptop : theme === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      className="theme-control"
      aria-label={`Thème ${labels[theme]} — activer le thème ${labels[next]}`}
      title={`Thème ${labels[theme]} · choisir ${labels[next]}`}
      onClick={() => {
        volatileTheme = next;
        try {
          localStorage.setItem(key, next);
          volatileTheme = undefined;
        } catch {
          /* The current page still supports a manual override when storage is unavailable. */
        }
        apply(next);
        window.dispatchEvent(
          new CustomEvent("mon-enfant-theme", { detail: next }),
        );
      }}
    >
      <Icon size={19} aria-hidden="true" />
    </button>
  );
}
