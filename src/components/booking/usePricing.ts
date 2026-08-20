"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PricingData, PricingGrid } from "@/lib/pricing";
import { setOpeningHours } from "@/lib/booking";
import { formatDateISO } from "@/lib/utils";

export interface PricingVersion {
  effectiveFrom: string;
  grid: PricingGrid;
}

type PricingApiData = PricingData & { versions?: PricingVersion[] };

export function usePricing() {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [versions, setVersions] = useState<PricingVersion[]>([]);
  const gridCacheRef = useRef(new Map<string, PricingGrid>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPricing = useCallback((signal?: { cancelled: boolean }) => {
    setLoading(true);
    setError(null);
    fetch("/api/pricing")
      .then((res) => res.json() as Promise<{ success: boolean; data?: PricingApiData; error?: string }>)
      .then((json) => {
        if (signal?.cancelled) return;
        if (json.success && json.data) {
          const nextVersions = Array.isArray(json.data.versions) && json.data.versions.length > 0
            ? json.data.versions
            : [{ effectiveFrom: "", grid: json.data.grid }];
          gridCacheRef.current.clear();
          setPricing(json.data);
          setVersions(nextVersions);
          // Wire DB-driven opening hours so the public flow uses admin edits
          if (json.data.openingHours) {
            setOpeningHours(json.data.openingHours as Record<string, Record<number, { open: string; close: string }>>);
          }
        } else {
          setError(json.error || "Failed to load pricing");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (signal?.cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load pricing");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    fetchPricing(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [fetchPricing]);

  const refetch = useCallback(() => fetchPricing(), [fetchPricing]);

  useEffect(() => {
    gridCacheRef.current.clear();
  }, [pricing, versions]);

  const gridFor = useCallback((date: Date | string): PricingGrid | null => {
    const sessionISO = date instanceof Date
      ? formatDateISO(date)
      : date;
    const cached = gridCacheRef.current.get(sessionISO);
    if (cached) return cached;

    const resolved = versions.reduce<PricingGrid | null>((selected, version) => (
      version.effectiveFrom <= sessionISO ? version.grid : selected
    ), null) ?? versions[0]?.grid ?? pricing?.grid ?? null;
    if (resolved) gridCacheRef.current.set(sessionISO, resolved);
    return resolved;
  }, [pricing, versions]);

  return { pricing, loading, error, refetch, versions, gridFor };
}
