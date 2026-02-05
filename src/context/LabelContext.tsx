/* eslint-disable react-refresh/only-export-components */
import { invoke } from '@tauri-apps/api/core';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type BusinessMode = 'hotel' | 'restaurant' | 'retail' | 'salon' | 'cafe';

function normalizeBusinessMode(raw: string | null | undefined): BusinessMode | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return null;
  // Legacy / merged mode
  if (v === 'barbershop') return 'salon';

  if (v === 'hotel' || v === 'restaurant' || v === 'retail' || v === 'salon' || v === 'cafe') {
    return v;
  }
  return null;
}

type Labels = {
  unit: string;
  client: string;
  action: string;
  actionOut: string;
};

export type FeatureFlags = {
  /** Shows a resource/table/room style grid elsewhere in the app (future use). */
  showGrid: boolean;
  /** Retail UX: big scan/search bar + fast cart workflow. */
  retailQuickScan: boolean;
  /** Restaurant/Cafe UX: kitchen printing / KOT actions. */
  restaurantKitchen: boolean;
  /** Retail UX: cart should be wide (roughly half the screen). */
  wideCart: boolean;
};

export const labels: Record<BusinessMode, Labels> = {
  hotel: { unit: 'Room', client: 'Guest', action: 'Check In', actionOut: 'Check Out' },
  restaurant: { unit: 'Table', client: 'Customer', action: 'Seat', actionOut: 'Close' },
  retail: { unit: 'Terminal', client: 'Customer', action: 'Start Sale', actionOut: 'Checkout' },
  salon: { unit: 'Station', client: 'Customer', action: 'Start Service', actionOut: 'Complete' },
  cafe: { unit: 'Table', client: 'Customer', action: 'Seat', actionOut: 'Close' },
};

export const features: Record<BusinessMode, FeatureFlags> = {
  hotel: { showGrid: true, retailQuickScan: false, restaurantKitchen: false, wideCart: false },
  restaurant: { showGrid: true, retailQuickScan: false, restaurantKitchen: true, wideCart: false },
  cafe: { showGrid: true, retailQuickScan: false, restaurantKitchen: true, wideCart: false },
  retail: { showGrid: false, retailQuickScan: true, restaurantKitchen: false, wideCart: true },
  salon: { showGrid: true, retailQuickScan: false, restaurantKitchen: false, wideCart: false },
};

interface LabelContextType {
  mode: BusinessMode;
  setMode: (mode: BusinessMode) => void;
  current: Labels;
  flags: FeatureFlags;
}

const LabelContext = createContext<LabelContextType | undefined>(undefined);

export function useLabels(): LabelContextType {
  const ctx = useContext(LabelContext);
  if (!ctx) throw new Error('useLabels must be used within a LabelProvider');
  return ctx;
}

export const LabelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<BusinessMode>('hotel');
  const modeRef = React.useRef<BusinessMode>('hotel');
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Load persisted mode (backend preferred, localStorage fallback)
  useEffect(() => {
    let cancelled = false;

    const fromStorage = normalizeBusinessMode(localStorage.getItem('bm_business_mode'));
    if (fromStorage) setMode(fromStorage);

    (async () => {
      try {
        const status = await invoke<{ mode: string; locked: boolean }>('get_business_mode_status');
        if (cancelled) return;

        // If backend is locked, it is the source of truth.
        if (status?.locked) {
          const normalized = normalizeBusinessMode(status.mode);
          if (normalized) setMode(normalized);
          return;
        }

        // If not locked and we have a localStorage selection (e.g., just finished setup), prefer it.
        const storageMode = normalizeBusinessMode(localStorage.getItem('bm_business_mode'));
        if (storageMode) setMode(storageMode);
      } catch {
        // Ignore (web mode, older backend, etc.)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setModeSafely = (next: BusinessMode) => {
    const prev = modeRef.current;
    if (prev === next) return;

    // Update UI terminology and localStorage.
    setMode(next);
    localStorage.setItem('bm_business_mode', next);
  };

  const value = useMemo<LabelContextType>(() => {
    return {
      mode,
      setMode: setModeSafely,
      current: labels[mode],
      flags: features[mode],
    };
  }, [mode]);

  return <LabelContext.Provider value={value}>{children}</LabelContext.Provider>;
};
