import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { formatPower, formatPowerValue, POWER_UNITS } from '../../js/dashboard-presenter.js';

const STORAGE_KEY = 'tpd-power-unit';
const UnitContext = createContext(null);

function readStoredUnit() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'mw' || value === 'wan' ? value : 'wan';
  } catch {
    return 'wan';
  }
}

export function UnitProvider({ children }) {
  const [unit, setUnitState] = useState(readStoredUnit);
  const setUnit = useCallback((next) => {
    setUnitState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply does not persist when storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({
    unit,
    unitLabel: POWER_UNITS[unit].label,
    setUnit,
    power: (mw, digits) => formatPower(mw, unit, digits),
    powerValue: (mw, digits) => formatPowerValue(mw, unit, digits)
  }), [unit, setUnit]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useUnit() {
  const value = useContext(UnitContext);
  if (!value) throw new Error('useUnit must be used inside UnitProvider');
  return value;
}
