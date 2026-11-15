// Cloud-only dependency resolution. Publishes manifests, never node_modules or credentials.
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
if (process.env.GITHUB_ACTIONS !== "true")
  throw new Error("Run mobile dependency installation in GitHub Actions");
const root = mkdtempSync(join(tmpdir(), "mon-enfant-mobile-"));
const run = (command, args) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
run("npm", ["pack", "expo-template-blank-typescript@58.0.34", "--silent"]);
run("tar", [
  "-xzf",
  "expo-template-blank-typescript-58.0.34.tgz",
  "--strip-components=1",
]);
const packagePath = join(root, "package.json");
let pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.name = "mon-enfant-parent";
pkg.private = true;
pkg.main = "expo-router/entry";
pkg.scripts = {
  start: "expo start",
  android: "expo run:android",
  ios: "expo run:ios",
  typecheck: "tsc --noEmit",
  test: "vitest run",
  export: "expo export --platform all",
  checkdeps: "expo install --check",
};
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
run("npm", ["install"]);
run("npx", [
  "expo",
  "install",
  "expo-router",
  "expo-secure-store",
  "expo-constants",
  "expo-linking",
  "expo-splash-screen",
  "expo-status-bar",
  "expo-crypto",
  "expo-camera",
  "react-native-screens",
  "react-native-safe-area-context",
  "react-native-svg",
  "@react-native-async-storage/async-storage",
  "react-native-url-polyfill",
  "react-dom",
  "react-native-web",
  "@expo/metro-runtime",
]);
run("npm", [
  "install",
  "--save-exact",
  "@supabase/supabase-js@2.119.0",
  "react-native-qrcode-svg@6.3.54",
  "lucide-react-native@1.72.0",
]);
run("npm", [
  "install",
  "--save-dev",
  "--save-exact",
  "typescript@6.0.3",
  "@types/node@26.6.6",
  "vitest@5.1.0",
]);
pkg = JSON.parse(readFileSync(packagePath, "utf8"));
for (const section of ["dependencies", "devDependencies"])
  for (const name of Object.keys(pkg[section] ?? {}))
    pkg[section][name] = JSON.parse(
      readFileSync(join(root, "node_modules", name, "package.json"), "utf8"),
    ).version;
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
run("npm", ["install", "--package-lock-only", "--ignore-scripts"]);
run("npx", ["expo", "install", "--check"]);
const target = join(process.cwd(), "test-results/mobile-manifests");
mkdirSync(target, { recursive: true });
for (const f of ["package.json", "package-lock.json"])
  copyFileSync(join(root, f), join(target, f));
console.log(
  "Pinned Expo-compatible mobile manifests are ready; no local installation required.",
);
