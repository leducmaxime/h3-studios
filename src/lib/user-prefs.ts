"use client";
import { splitDisplayName, isClientType, type ClientType } from "./booking-fields";

const STORAGE_KEY = "h3-studios-user-prefs";

export interface UserPreferences {
  firstName: string;
  lastName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
  clientType: ClientType | null;
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
    const parsed = JSON.parse(data) as Partial<UserPreferences> & { userName?: string };
    if (!parsed.firstName?.trim() && !parsed.lastName?.trim() && parsed.userName) Object.assign(parsed, splitDisplayName(parsed.userName));
    return { ...parsed, firstName: parsed.firstName ?? "", lastName: parsed.lastName ?? "", clientType: isClientType(parsed.clientType) ? parsed.clientType : null } as UserPreferences;
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
