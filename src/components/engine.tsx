"use client";

import { createContext, useContext, useMemo } from "react";
import { compileCatalog, type Catalog } from "@/engine/catalog";
import type { PhotoSet, TripPreset } from "@/engine/preset-schema";
import type { TripRules } from "@/engine/rules";
import { createEngine, type Engine } from "@/engine/structure";

const EngineContext = createContext<Engine | null>(null);

/**
 * The trip engine for everything below: the trip's preset (sent by the page,
 * never bundled) compiled once, plus the live rules it was rendered with.
 * (The preset's theme is applied by <PresetTheme> in the trip layout.)
 */
export function EngineProvider({
  preset,
  photos,
  rules,
  children,
}: {
  preset: TripPreset;
  photos: PhotoSet;
  rules: TripRules;
  children: React.ReactNode;
}) {
  const catalog = useMemo(() => compileCatalog(preset, photos), [preset, photos]);
  const engine = useMemo(() => createEngine(catalog, rules), [catalog, rules]);
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useEngine(): Engine {
  const e = useContext(EngineContext);
  if (!e) throw new Error("useEngine() outside <EngineProvider>");
  return e;
}

/** The engine, or null outside a trip (Caravan's own pages). */
export const useMaybeEngine = (): Engine | null => useContext(EngineContext);

export const useCatalog = (): Catalog => useEngine().catalog;
export const useRules = (): TripRules => useEngine().rules;
