import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { AppSettings } from '../types';

interface SettingsContextValue {
  settings: AppSettings;
  categoryNames: string[];
  uomCodes: string[];
  refreshSettings: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  roundingDecimals: 2,
  defaultCurrency: 'MYR',
  defaultLocation: '',
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [categoryNames, setCategoryNames] = useState<string[]>([
    'Labour', 'Material', 'Equipment', 'Subcontract', 'Overhead', 'Other',
  ]);
  const [uomCodes, setUomCodes] = useState<string[]>([
    'LS', 'm', 'm2', 'm3', 'kg', 'tonne', 'nr', 'hr', 'day', 'month',
  ]);

  async function refreshSettings() {
    try {
      const [catRes, uomRes, settingsRes] = await Promise.all([
        supabase.from('categories').select('name').eq('is_active', true).order('sort_order'),
        supabase.from('uom_library').select('code').eq('is_active', true).order('sort_order'),
        supabase.from('admin_settings').select('key, value'),
      ]);

      if (catRes.data && catRes.data.length > 0) {
        setCategoryNames(catRes.data.map((c) => c.name));
      }

      if (uomRes.data && uomRes.data.length > 0) {
        setUomCodes(uomRes.data.map((u) => u.code));
      }

      if (settingsRes.data) {
        const parsed: Partial<AppSettings> = {};
        for (const row of settingsRes.data) {
          if (row.key === 'rounding_decimals' && typeof row.value === 'number') {
            parsed.roundingDecimals = row.value;
          }
          if (row.key === 'default_currency' && typeof row.value === 'string') {
            parsed.defaultCurrency = row.value;
          }
          if (row.key === 'default_location' && typeof row.value === 'string') {
            parsed.defaultLocation = row.value;
          }
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // silently fail, defaults remain
    }
  }

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, categoryNames, uomCodes, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
