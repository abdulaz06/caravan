"use client";

import { createContext, useContext, useEffect } from "react";

// Family-friendly mode (the switch on the review page) as context, so any
// component that could show nightlife wording — badges, filters, notes — can
// leave it out while it's on. View-only: nothing here is ever saved.
const FamilyContext = createContext(false);

export function FamilyProvider({ on, children }: { on: boolean; children: React.ReactNode }) {
  // Marks the page so copy outside the app tree (the desktop poster panel) can swap its words too.
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset.family = "on";
    return () => {
      delete document.documentElement.dataset.family;
    };
  }, [on]);
  return <FamilyContext.Provider value={on}>{children}</FamilyContext.Provider>;
}

export const useFamily = () => useContext(FamilyContext);
