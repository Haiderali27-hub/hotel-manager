/* eslint-disable react-refresh/only-export-components */
import { invoke } from '@tauri-apps/api/core';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type CurrencyCode = string;

type CurrencyContextValue = {
  currencyCode: CurrencyCode;
  locale: string;
  supportedCurrencies: CurrencyCode[];
  setCurrencyCode: (code: CurrencyCode) => Promise<void>;
  setLocale: (locale: string) => Promise<void>;
  formatMoney: (amount: number, options?: { maximumFractionDigits?: number }) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const FALLBACK_CURRENCIES: CurrencyCode[] = [
  'AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD',
  'CAD','CDF','CHF','CLP','CNY','COP','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','FOK','GBP','GEL','GGP','GHS',
  'GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HRK','HTG','HUF','IDR','ILS','IMP','INR','IQD','IRR','ISK','JEP','JMD','JOD','JPY','KES','KGS','KHR','KID',
  'KMF','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN',
  'NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD',
  'SHP','SLE','SLL','SOS','SRD','SSP','STN','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TVD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES',
  'VND','VUV','WST','XAF','XCD','XDR','XOF','XPF','YER','ZAR','ZMW','ZWL'
];

const getSupportedCurrencies = (): CurrencyCode[] => {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    try {
      const list = supportedValuesOf('currency');
      if (Array.isArray(list) && list.length > 0) return [...list].sort();
    } catch {
      // ignore and fallback
    }
  }
  return [...FALLBACK_CURRENCIES].sort();
};

export const CurrencyProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [currencyCode, setCurrencyCodeState] = useState<CurrencyCode>('USD');
  const [locale, setLocaleState] = useState<string>('en-US');
  const [isLoaded, setIsLoaded] = useState(false);

  const supportedCurrencies = useMemo(() => getSupportedCurrencies(), []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [code, storedLocale] = await Promise.all([
          invoke<string>('get_currency_code').catch(() => 'USD'),
          invoke<string>('get_locale').catch(() => 'en-US'),
        ]);

        if (!isMounted) return;
        setCurrencyCodeState(typeof code === 'string' && code ? code.toUpperCase() : 'USD');
        setLocaleState(typeof storedLocale === 'string' && storedLocale ? storedLocale : 'en-US');
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const setCurrencyCode = async (code: CurrencyCode) => {
    const normalized = String(code || '').trim().toUpperCase();
    await invoke('set_currency_code', { code: normalized });
    setCurrencyCodeState(normalized);
  };

  const setLocale = async (newLocale: string) => {
    const normalized = String(newLocale || '').trim();
    await invoke('set_locale', { locale: normalized });
    setLocaleState(normalized);
  };

  const formatMoney = (amount: number, options?: { maximumFractionDigits?: number }) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;

    try {
      const nf = new Intl.NumberFormat(locale || 'en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
        maximumFractionDigits: options?.maximumFractionDigits ?? 2,
      });
      return nf.format(safeAmount);
    } catch {
      const digits = options?.maximumFractionDigits ?? 2;
      const fixed = safeAmount.toFixed(digits);
      return `${currencyCode || 'USD'} ${fixed}`;
    }
  };

  const value: CurrencyContextValue = {
    currencyCode,
    locale,
    supportedCurrencies,
    setCurrencyCode,
    setLocale,
    formatMoney,
  };

  if (!isLoaded) {
    // Keep startup simple: render children while loading, defaults are safe.
    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = (): CurrencyContextValue => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
};
