import { invoke } from '@tauri-apps/api/core';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type BusinessMode = 'hotel' | 'restaurant' | 'retail';

type Labels = {
  unit: string;
  client: string;
  action: string;
  actionOut: string;
};

export const labels: Record<BusinessMode, Labels> = {
  hotel: { unit: 'Room', client: 'Guest', action: 'Check In', actionOut: 'Check Out' },
  restaurant: { unit: 'Table', client: 'Diner', action: 'Seat', actionOut: 'Close' },
  retail: { unit: 'Terminal', client: 'Customer', action: 'Start Sale', actionOut: 'Checkout' },
};

interface LabelContextType {
  mode: BusinessMode;
  setMode: (mode: BusinessMode) => void;
  current: Labels;
}

const LabelContext = createContext<LabelContextType | undefined>(undefined);

export function useLabels(): LabelContextType {
  const ctx = useContext(LabelContext);
  if (!ctx) throw new Error('useLabels must be used within a LabelProvider');
  return ctx;
}

export const LabelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<BusinessMode>('hotel');

  // Load persisted mode (backend preferred, localStorage fallback)
  useEffect(() => {
    let cancelled = false;

    const fromStorage = localStorage.getItem('bm_business_mode');
    if (fromStorage === 'hotel' || fromStorage === 'restaurant' || fromStorage === 'retail') {
      setMode(fromStorage);
    }

    (async () => {
      try {
        const backendMode = await invoke<string>('get_business_mode');
        if (cancelled) return;

        if (backendMode === 'hotel' || backendMode === 'restaurant' || backendMode === 'retail') {
          setMode(backendMode);
        }
      } catch {
        // Ignore (web mode, older backend, etc.)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist mode best-effort
  useEffect(() => {
    localStorage.setItem('bm_business_mode', mode);
    (async () => {
      try {
        await invoke('set_business_mode', { mode });
      } catch {
        // Ignore (web mode, older backend, etc.)
      }
    })();
  }, [mode]);

  const value = useMemo<LabelContextType>(() => {
    return {
      mode,
      setMode,
      current: labels[mode],
    };
  }, [mode]);

  return <LabelContext.Provider value={value}>{children}</LabelContext.Provider>;
};
