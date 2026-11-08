/**
 * Client-side persistence for BYOK (Bring Your Own Key) and Client Identifier.
 * All keys are stored strictly in the user's browser localStorage.
 */

const API_KEY_STORAGE_KEY = 'tabletell_custom_ai_key';
const CLIENT_ID_STORAGE_KEY = 'tabletell_client_id';

type KeyChangeCallback = (key: string | null) => void;
const listeners = new Set<KeyChangeCallback>();

export function getCustomApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = localStorage.getItem(API_KEY_STORAGE_KEY);
    return key ? key.trim() : null;
  } catch {
    return null;
  }
}

export function setCustomApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanKey = key.trim();
    if (cleanKey) {
      localStorage.setItem(API_KEY_STORAGE_KEY, cleanKey);
      listeners.forEach((cb) => cb(cleanKey));
    } else {
      clearCustomApiKey();
    }
  } catch (err) {
    console.error('Failed to save API key to localStorage', err);
  }
}

export function clearCustomApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    listeners.forEach((cb) => cb(null));
  } catch (err) {
    console.error('Failed to clear API key from localStorage', err);
  }
}

export function onCustomApiKeyChange(callback: KeyChangeCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Returns a persistent UUID for this browser client to track daily free queries.
 */
export function getClientId(): string {
  if (typeof window === 'undefined') return 'server_render';
  try {
    let cid = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!cid) {
      cid = 'cid_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, cid);
    }
    return cid;
  } catch {
    return 'anonymous_client';
  }
}
