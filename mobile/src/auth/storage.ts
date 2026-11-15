import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createChunkStorage } from "./chunk-storage";
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const REMEMBER = "mon-enfant.auth.remember.v1",
  INSTALLED = "mon-enfant.installed.v1";
export async function prepareAuthStorage(storageKey: string) {
  const memory = new Map<string, string>();
  const native = Platform.OS !== "web";
  const encrypted = createChunkStorage({
    getItem: (k) => SecureStore.getItemAsync(k, options),
    setItem: (k, v) => SecureStore.setItemAsync(k, v, options),
    removeItem: (k) => SecureStore.deleteItemAsync(k, options),
  });
  // Keychain values can survive an iOS uninstall. A nonclinical installation marker prevents restoring those sessions after a new installation.
  if (native && !(await AsyncStorage.getItem(INSTALLED))) {
    for (const k of [
      storageKey,
      storageKey + "-code-verifier",
      storageKey + "-user",
    ])
      await encrypted.removeItem(k);
    await SecureStore.deleteItemAsync(REMEMBER, options);
    await AsyncStorage.setItem(INSTALLED, "1");
  }
  let remember =
    native && (await SecureStore.getItemAsync(REMEMBER, options)) === "1";
  const storage = {
    getItem: async (key: string) =>
      remember ? encrypted.getItem(key) : (memory.get(key) ?? null),
    setItem: async (key: string, value: string) => {
      if (remember) await encrypted.setItem(key, value);
      else memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
      if (native) await encrypted.removeItem(key);
    },
  };
  return {
    storage,
    remember,
    async setRemember(value: boolean) {
      if (native) {
        await SecureStore.setItemAsync(REMEMBER, value ? "1" : "0", options);
        if (!value)
          for (const k of [
            storageKey,
            storageKey + "-code-verifier",
            storageKey + "-user",
          ])
            await encrypted.removeItem(k);
      }
      remember = native && value;
      memory.clear();
    },
    async clear() {
      memory.clear();
      remember = false;
      if (native) {
        for (const k of [
          storageKey,
          storageKey + "-code-verifier",
          storageKey + "-user",
        ])
          await encrypted.removeItem(k);
        await SecureStore.deleteItemAsync(REMEMBER, options);
      }
    },
  };
}
