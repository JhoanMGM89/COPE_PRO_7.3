import type { Session } from "@supabase/supabase-js";

const AUTH_SESSION_BACKUP_KEY = "cope_auth_backup_v1";

type SessionBackup = {
  access_token: string;
  refresh_token: string;
};

const memoryStorage = new Map<string, string>();

const createMemoryStorage = () => ({
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStorage.set(key, value);
  },
  removeItem: (key: string) => {
    memoryStorage.delete(key);
  },
});

const getSafeStorage = () => {
  if (typeof window === "undefined") return createMemoryStorage();

  try {
    const testKey = "__cope_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {}

  try {
    const testKey = "__cope_storage_test__";
    window.sessionStorage.setItem(testKey, "1");
    window.sessionStorage.removeItem(testKey);
    return window.sessionStorage;
  } catch {}

  return createMemoryStorage();
};

export const getAuthSessionBackupKey = () => AUTH_SESSION_BACKUP_KEY;

export const saveSessionBackup = (session: Session | null | undefined) => {
  if (!session?.access_token || !session?.refresh_token) return;

  const storage = getSafeStorage();
  const backup: SessionBackup = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };

  try {
    storage.setItem(AUTH_SESSION_BACKUP_KEY, JSON.stringify(backup));
  } catch {}
};

export const readSessionBackup = (): SessionBackup | null => {
  const storage = getSafeStorage();

  try {
    const raw = storage.getItem(AUTH_SESSION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionBackup>;
    if (!parsed.access_token || !parsed.refresh_token) return null;
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    };
  } catch {
    return null;
  }
};

export const clearSessionBackup = () => {
  try {
    // Signal standalone bootstrap to allow real removal
    if (typeof window !== "undefined" && (window as any).__clearStandaloneAuthBackup) {
      (window as any).__clearStandaloneAuthBackup();
    }
    const storage = getSafeStorage();
    storage.removeItem(AUTH_SESSION_BACKUP_KEY);
  } catch {}
};