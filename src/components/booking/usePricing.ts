"use client";

import { useState, useEffect, useCallback } from "react";
import type { PricingData } from "@/lib/pricing";

export function usePricing() {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPricing = useCallback((signal?: { cancelled: boolean }) => {
    setLoading(true);
    setError(null);
    fetch("/api/pricing")
      .then((res) => res.json() as Promise<{ success: boolean; data?: PricingData; error?: string }>)
      .then((json) => {
        if (signal?.cancelled) return;
        if (json.success && json.data) {
          setPricing(json.data);
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

  return { pricing, loading, error, refetch };
}
