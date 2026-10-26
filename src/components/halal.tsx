"use client";

import { createContext, useContext, useEffect } from "react";

// Halal mode (the review page's crescent-moon easter egg) as context, so any
// component that could show nightlife wording — badges, filters, notes — can
// leave it out while it's on. View-only: nothing here is ever saved.
const HalalContext = createContext(false);

export function HalalProvider({ on, children }: { on: boolean; children: React.ReactNode }) {
  // Marks the page so copy outside the app tree (the desktop poster panel) can swap its words too.
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset.halal = "on";
    return () => {
      delete document.documentElement.dataset.halal;
    };
  }, [on]);
  return <HalalContext.Provider value={on}>{children}</HalalContext.Provider>;
}

export const useHalal = () => useContext(HalalContext);
