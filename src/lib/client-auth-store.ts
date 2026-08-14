"use client";

import { useEffect, useSyncExternalStore } from "react";

export interface ClientUser {
  id: string;
  email: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  band_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
}
export type ClientAuthState = { status: "loading" | "ready"; user: ClientUser | null; logoutCount: number };
const loadingState: ClientAuthState = { status: "loading", user: null, logoutCount: 0 };
const readyGuestState: ClientAuthState = { status: "ready", user: null, logoutCount: 0 };
let state = loadingState;
let pendingRefresh: Promise<ClientUser | null> | null = null;
let authGeneration = 0;
const listeners = new Set<() => void>();

function setState(next: ClientAuthState) {
  if (state.status === next.status && state.user === next.user) return;
  state = next;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function getClientAuthState() { return state; }
export function useClientAuth(): ClientAuthState {
  return useSyncExternalStore(subscribe, getClientAuthState, () => loadingState);
}
export async function refresh(): Promise<ClientUser | null> {
  if (pendingRefresh) return pendingRefresh;
  const generation = authGeneration;
  const request = fetch("/api/client/me")
    .then(async (response) => {
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) return state.status === "loading" ? null : state.user;
      const data = (await response.json()) as { data?: ClientUser };
      return data.data ?? null;
    }).catch(() => state.status === "loading" ? null : state.user).then((user) => {
      if (generation !== authGeneration) return state.user;
      setState(user ? { status: "ready", user, logoutCount: state.logoutCount } : { ...readyGuestState, logoutCount: state.logoutCount });
      return user;
    }).finally(() => { if (pendingRefresh === request) pendingRefresh = null; });
  pendingRefresh = request;
  return request;
}
export async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/client/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = (await response.json()) as { success?: boolean; data?: ClientUser; error?: string };
    if (!response.ok || !data.success || !data.data) return { ok: false, error: data.error };
    authGeneration++;
    pendingRefresh = null;
    setState({ status: "ready", user: data.data, logoutCount: state.logoutCount });
    return { ok: true };
  } catch { return { ok: false, error: "Erreur de connexion au serveur" }; }
}
export async function logout(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/client/logout", { method: "POST" });
    if (!response.ok) return { ok: false, error: "Erreur lors de la déconnexion" };
    authGeneration++;
    pendingRefresh = null;
    setState({ status: "ready", user: null, logoutCount: state.logoutCount + 1 });
    return { ok: true };
  } catch { return { ok: false, error: "Erreur de connexion au serveur" }; }
}
export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void refresh();
    let lastFocusRefresh = 0;
    const onFocus = () => {
      if (getClientAuthState().status !== "loading" && Date.now() - lastFocusRefresh >= 30_000) {
        lastFocusRefresh = Date.now();
        void refresh();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return children;
}
