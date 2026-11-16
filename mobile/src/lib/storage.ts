import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Tokens live in the OS keychain/keystore; the web build (dev preview only) falls back to localStorage.
const web = Platform.OS === 'web';

export const storage = {
  get: (key: string) => (web ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string) => (web ? Promise.resolve(globalThis.localStorage?.setItem(key, value)) : SecureStore.setItemAsync(key, value)),
  remove: (key: string) => (web ? Promise.resolve(globalThis.localStorage?.removeItem(key)) : SecureStore.deleteItemAsync(key)),
};
