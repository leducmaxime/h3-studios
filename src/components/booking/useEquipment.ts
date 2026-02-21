"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiEquipment {
  id: string;
  name: string;
  maxPerSession: number;
  pricingType: "hourly" | "session";
  sessionPricing: number[] | null;
  pricePerHour: number;
}

let cachedEquipment: ApiEquipment[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export function useEquipment() {
  const [equipment, setEquipment] = useState<ApiEquipment[]>(cachedEquipment || []);
  const [loading, setLoading] = useState(!cachedEquipment);
  const [error, setError] = useState<string | null>(null);

  const fetchEquipment = useCallback(async () => {
    if (cachedEquipment && Date.now() - cacheTimestamp < CACHE_DURATION) {
      setEquipment(cachedEquipment);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/equipment");
      if (!res.ok) throw new Error("Failed to fetch equipment");
      const data = await res.json() as { success: boolean; equipment?: ApiEquipment[]; error?: string };
      if (data.success && data.equipment) {
        cachedEquipment = data.equipment;
        cacheTimestamp = Date.now();
        setEquipment(data.equipment);
      } else {
        throw new Error(data.error || "Failed to fetch equipment");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const getEquipmentName = useCallback((id: string): string => {
    const eq = equipment.find((e) => e.id === id);
    return eq?.name || id;
  }, [equipment]);

  const getEquipment = useCallback((id: string): ApiEquipment | undefined => {
    return equipment.find((e) => e.id === id);
  }, [equipment]);

  return { equipment, loading, error, getEquipmentName, getEquipment };
}
