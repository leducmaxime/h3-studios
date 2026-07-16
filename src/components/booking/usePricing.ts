"use client";

import { useState, useEffect } from "react";
import type { PricingData } from "@/lib/pricing";

export function usePricing() {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/pricing")
      .then((res) => res.json() as Promise<{ success: boolean; data?: PricingData; error?: string }>)
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.data) {
          setPricing(json.data);
        } else {
          setError(json.error || "Failed to load pricing");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load pricing");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { pricing, loading, error };
}
