"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { defaultUnitForLocale, type TempUnit } from "@/lib/temperature";

const STORAGE_KEY = "ci_temp_unit";

type UnitContextValue = {
  unit: TempUnit;
  setUnit: (unit: TempUnit) => void;
  toggle: () => void;
  /** True once the user has chosen a unit rather than being defaulted. */
  isExplicit: boolean;
};

const UnitContext = createContext<UnitContextValue | null>(null);

export function UnitProvider({
  children,
  initialUnit,
}: {
  children: ReactNode;
  /** Server-supplied preference. Overrides client detection when present. */
  initialUnit?: TempUnit;
}) {
  // Start from a deterministic value so server and client markup agree; the
  // stored preference is applied after mount to avoid a hydration mismatch.
  const [unit, setUnitState] = useState<TempUnit>(initialUnit ?? "F");
  const [isExplicit, setIsExplicit] = useState(false);

  useEffect(() => {
    if (initialUnit) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "F" || stored === "C") {
        setUnitState(stored);
        setIsExplicit(true);
        return;
      }
    } catch {
      // Private browsing or blocked storage. Fall through to locale.
    }
    setUnitState(defaultUnitForLocale(navigator.language));
  }, [initialUnit]);

  function setUnit(next: TempUnit) {
    setUnitState(next);
    setIsExplicit(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply will not persist; not worth surfacing.
    }
  }

  return (
    <UnitContext.Provider
      value={{ unit, setUnit, toggle: () => setUnit(unit === "F" ? "C" : "F"), isExplicit }}
    >
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit(): UnitContextValue {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error("useUnit must be used within a UnitProvider");
  return ctx;
}
