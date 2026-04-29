// Tiny localStorage-backed history for any string address (license server
// host:port, callbox URL, etc.). Keeps the most-recently-used at the
// front, dedupes, caps at MAX entries.
//
// Backed by a single JSON array under the given storage key. SSR-safe —
// returns [] on the server and hydrates on first effect.
import { useCallback, useEffect, useState } from 'react';

const MAX_ENTRIES = 12;

interface UseCachedAddressesResult {
  addresses: string[];
  remember: (addr: string) => void;
  forget: (addr: string) => void;
  clear: () => void;
}

export function useCachedAddresses(storageKey: string): UseCachedAddressesResult {
  const [addresses, setAddresses] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
    } catch { return []; }
  });

  // Cross-tab sync. If another tab/window appends an address, pick it up.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) setAddresses(parsed.filter(x => typeof x === 'string'));
      } catch { /* malformed — ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const persist = useCallback((next: string[]) => {
    setAddresses(next);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); }
      catch { /* quota / disabled — keep state in memory */ }
    }
  }, [storageKey]);

  const remember = useCallback((addrRaw: string) => {
    const addr = (addrRaw ?? '').trim();
    if (!addr) return;
    setAddresses(prev => {
      const next = [addr, ...prev.filter(a => a !== addr)].slice(0, MAX_ENTRIES);
      if (typeof window !== 'undefined') {
        try { window.localStorage.setItem(storageKey, JSON.stringify(next)); }
        catch { /* ignore */ }
      }
      return next;
    });
  }, [storageKey]);

  const forget = useCallback((addr: string) => {
    persist(addresses.filter(a => a !== addr));
  }, [addresses, persist]);

  const clear = useCallback(() => persist([]), [persist]);

  return { addresses, remember, forget, clear };
}
