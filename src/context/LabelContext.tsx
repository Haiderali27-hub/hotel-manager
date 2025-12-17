import React, { createContext, useContext, useMemo, useState } from 'react';

export type BusinessMode = 'hotel' | 'restaurant' | 'retail';

type Labels = {
  unit: string;
  client: string;
  action: string;
};

export const labels: Record<BusinessMode, Labels> = {
  hotel: { unit: 'Room', client: 'Guest', action: 'Check In' },
  restaurant: { unit: 'Table', client: 'Diner', action: 'Seating' },
  retail: { unit: 'Terminal', client: 'Customer', action: 'Checkout' },
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

  const value = useMemo<LabelContextType>(() => {
    return {
      mode,
      setMode,
      current: labels[mode],
    };
  }, [mode]);

  return <LabelContext.Provider value={value}>{children}</LabelContext.Provider>;
};
