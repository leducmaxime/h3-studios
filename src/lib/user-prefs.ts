"use client";
import type { ClientType } from "./booking-fields";

const STORAGE_KEY = "h3-studios-user-prefs";

export interface UserPreferences {
  userName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
  clientType: ClientType;
  legalName: string;
  siret: string;
  lastVisit: string;
}

export function saveUserPreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadUserPreferences();
    const updated = { ...existing, ...prefs, lastVisit: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available
  }
}

export function loadUserPreferences(): UserPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** Efface les préférences de pré-remplissage après une déconnexion. */
export function clearUserPreferences(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
