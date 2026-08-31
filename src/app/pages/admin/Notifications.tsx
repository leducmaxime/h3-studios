"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  BellOff,
  ShieldAlert,
  ShieldCheck,
  Share,
  SquarePlus,
  Smartphone,
  Laptop,
  Send,
  Loader2,
  Trash2,
  RefreshCw,
  Info,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types & constantes
// ---------------------------------------------------------------------------

interface PushConfig {
  vapidPublicKey: string;
  supported: boolean;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  userAgent: string;
  createdAt: string;
}

interface PushState {
  subscriptions: PushSubscriptionRow[];
  preferences: Record<string, boolean>;
}

type Phase = "loading" | "ios-install" | "unsupported" | "ready";

const EVENT_TYPES: { key: string; label: string }[] = [
  { key: "booking_created", label: "Nouvelle réservation" },
  { key: "booking_cancelled", label: "Annulation" },
  { key: "booking_rescheduled", label: "Déplacement" },
  { key: "no_show", label: "Client absent" },
  { key: "payment_received", label: "Paiement reçu" },
  { key: "refund", label: "Remboursement" },
  { key: "contact_message", label: "Message de contact" },
  { key: "session_reminder", label: "Rappel de séance" },
  { key: "sync_failure", label: "Échec de synchronisation" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function labelForUserAgent(ua: string): string {
  if (!ua) return "Appareil inconnu";
  const isIPhone = /iphone/i.test(ua);
  const isIPad = /ipad/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMac = /macintosh/i.test(ua);
  const isWindows = /windows/i.test(ua);

  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome\//i.test(ua)
      ? "Chrome"
      : /firefox\//i.test(ua)
        ? "Firefox"
        : /safari\//i.test(ua)
          ? "Safari"
          : "Navigateur";

  if (isIPhone) return "iPhone";
  if (isIPad) return "iPad";
  if (isAndroid) return `${browser} sur Android`;
  if (isMac) return `${browser} sur macOS`;
  if (isWindows) return `${browser} sur Windows`;
  return browser;
}

function iconForUserAgent(ua: string) {
  if (/iphone|ipad|android/i.test(ua)) return Smartphone;
  return Laptop;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

// ---------------------------------------------------------------------------
// Petits composants de présentation
// ---------------------------------------------------------------------------

function StatusHeader({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "warning" | "danger" | "success";
  title: string;
  description: string;
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-zinc-800 text-zinc-400",
    warning: "bg-primary/15 text-primary",
    danger: "bg-red-500/10 text-red-400",
    success: "bg-emerald-500/10 text-emerald-400",
  };

  return (
    <div className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  saving,
  onToggle,
}: {
  label: string;
  checked: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800 py-3 last:border-b-0">
      <span className="text-sm text-zinc-200">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        aria-pressed={checked}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-zinc-700"
        } ${saving ? "opacity-60" : ""}`}
      >
        {saving ? (
          <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-zinc-900" />
        ) : (
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminNotifications() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [isIOS, setIsIOS] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  const [config, setConfig] = useState<PushConfig | null>(null);
  const [pushState, setPushState] = useState<PushState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [localEndpoint, setLocalEndpoint] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  // -- Détection de l'environnement (iOS/standalone/support) --------------
  useEffect(() => {
    const ua = window.navigator.userAgent;
    const iOSDevice = /iphone|ipad|ipod/i.test(ua) && !("MSStream" in window);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    setIsIOS(iOSDevice);

    if (iOSDevice && !standalone) {
      setPhase("ios-install");
      return;
    }

    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    if (!supported) {
      setPhase("unsupported");
      return;
    }

    setPermission(Notification.permission);

    navigator.serviceWorker.register("/sw.js", { scope: "/admin" }).catch((err) => {
      console.error("Échec de l'enregistrement du service worker", err);
    });

    setPhase("ready");
  }, []);

  // -- Chargement config + état ---------------------------------------------
  const refreshData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [configRes, stateRes] = await Promise.all([
        fetch("/api/admin/push/config"),
        fetch("/api/admin/push/state"),
      ]);
      if (!configRes.ok || !stateRes.ok) throw new Error("bad-status");

      const configJson = (await configRes.json()) as { success: boolean; data?: PushConfig };
      const stateJson = (await stateRes.json()) as { success: boolean; data?: PushState };

      if (!configJson.success || !configJson.data || !stateJson.success || !stateJson.data) {
        throw new Error("bad-payload");
      }

      setConfig(configJson.data);
      setPushState(stateJson.data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;
    refreshData();
  }, [phase, refreshData]);

  // -- Détection de l'abonnement local --------------------------------------
  useEffect(() => {
    if (phase !== "ready" || permission !== "granted") return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setLocalEndpoint(sub ? sub.endpoint : null))
      .catch(() => setLocalEndpoint(null));
  }, [phase, permission]);

  // -- Actions ---------------------------------------------------------------

  const subscribeThisDevice = useCallback(async () => {
    if (!config?.vapidPublicKey) {
      toast.error("Configuration indisponible, réessayez plus tard");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource,
      });
    }
    const raw = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
    const res = await fetch("/api/admin/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: raw.keys?.p256dh || "", auth: raw.keys?.auth || "" },
        userAgent: navigator.userAgent,
      }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    if (json.success) {
      setLocalEndpoint(sub.endpoint);
      toast.success("Notifications activées sur cet appareil");
      await refreshData();
    } else {
      toast.error(json.error || "Erreur lors de l'inscription de l'appareil");
    }
  }, [config, refreshData]);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        if (result === "denied") {
          toast.error("Autorisation refusée");
        }
        return;
      }
      await subscribeThisDevice();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'activation des notifications");
    } finally {
      setEnabling(false);
    }
  };

  const handleDisableThisDevice = async () => {
    setDisabling(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setLocalEndpoint(null);
      toast.success("Notifications désactivées sur cet appareil");
      await refreshData();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la désactivation");
    } finally {
      setDisabling(false);
    }
  };

  const handleRemoveDevice = async (row: PushSubscriptionRow) => {
    if (row.endpoint === localEndpoint) {
      await handleDisableThisDevice();
      return;
    }
    setRemovingId(row.id);
    try {
      const res = await fetch("/api/admin/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: row.endpoint }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Appareil retiré");
        await refreshData();
      } else {
        toast.error(json.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setRemovingId(null);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/push/test", { method: "POST" });
      const json = (await res.json()) as {
        success: boolean;
        data?: { sent: number; results?: unknown[] };
        error?: string;
      };
      if (json.success && json.data) {
        toast.success(
          json.data.sent > 0
            ? `Notification de test envoyée à ${json.data.sent} appareil(s)`
            : "Aucun appareil actif pour recevoir le test",
        );
      } else {
        toast.error(json.error || "Échec de l'envoi du test");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setTesting(false);
    }
  };

  const handleTogglePreference = async (key: string) => {
    const current = pushState?.preferences?.[key] ?? true;
    const next = !current;
    setPushState((prev) =>
      prev ? { ...prev, preferences: { ...prev.preferences, [key]: next } } : prev,
    );
    setSavingPref(key);
    try {
      const res = await fetch("/api/admin/push/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: key, enabled: next }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error || "failed");
    } catch {
      setPushState((prev) =>
        prev ? { ...prev, preferences: { ...prev.preferences, [key]: current } } : prev,
      );
      toast.error("Erreur lors de l'enregistrement de la préférence");
    } finally {
      setSavingPref(null);
    }
  };

  // ---------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-zinc-400">Alertes push sur votre téléphone ou ordinateur</p>
      </div>

      {phase === "ios-install" && (
        <div className="space-y-4">
          <StatusHeader
            icon={Share}
            tone="warning"
            title="Installation requise"
            description="Sur iPhone et iPad, les notifications ne fonctionnent que depuis l'application installée sur l'écran d'accueil, pas depuis Safari."
          />
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold">Comment installer l'application</h3>
            <ol className="mt-4 space-y-4">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  1
                </span>
                <p className="text-sm text-zinc-300">
                  Ouvrez cette page dans <strong className="text-zinc-100">Safari</strong>, puis
                  appuyez sur l'icône{" "}
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs">
                    <Share className="h-3 w-3" /> Partager
                  </span>{" "}
                  dans la barre du bas.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  2
                </span>
                <p className="text-sm text-zinc-300">
                  Faites défiler et appuyez sur{" "}
                  <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs">
                    <SquarePlus className="h-3 w-3" /> Sur l'écran d'accueil
                  </span>
                  , puis confirmez.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  3
                </span>
                <p className="text-sm text-zinc-300">
                  Fermez Safari et ouvrez l'application depuis l'icône{" "}
                  <strong className="text-zinc-100">H3 Admin</strong> ajoutée à votre écran
                  d'accueil.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  4
                </span>
                <p className="text-sm text-zinc-300">
                  Revenez sur cette page « Notifications » pour les activer.
                </p>
              </li>
            </ol>
          </div>
        </div>
      )}

      {phase === "unsupported" && (
        <StatusHeader
          icon={BellOff}
          tone="neutral"
          title="Navigateur non pris en charge"
          description="Ce navigateur ne prend pas en charge les notifications push. Essayez avec Chrome, Edge ou Safari (iOS 16.4+, une fois l'application installée sur l'écran d'accueil)."
        />
      )}

      {phase === "ready" && (
        <>
          {permission === "default" && (
            <div className="space-y-4">
              <StatusHeader
                icon={Bell}
                tone="warning"
                title="Notifications désactivées"
                description="Activez les notifications pour être alerté des nouvelles réservations, annulations, paiements et messages, directement sur cet appareil."
              />
              <Button onClick={handleEnable} disabled={enabling} className="w-full sm:w-auto">
                {enabling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                Activer les notifications
              </Button>
            </div>
          )}

          {permission === "denied" && (
            <StatusHeader
              icon={ShieldAlert}
              tone="danger"
              title="Autorisation refusée"
              description={
                isIOS
                  ? "Ouvrez Réglages > Notifications > H3 Admin sur votre iPhone pour réactiver, puis revenez sur cette page."
                  : "Le navigateur ne redemandera pas l'autorisation automatiquement. Ouvrez les réglages du site (cadenas dans la barre d'adresse) et autorisez les notifications, puis revenez sur cette page."
              }
            />
          )}

          {permission === "granted" && (
            <div className="space-y-6">
              {loadError && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <p className="text-xs text-red-400">
                    Impossible de charger l'état des notifications. Le service est peut-être
                    indisponible.
                  </p>
                  <Button size="sm" variant="outline" onClick={refreshData} disabled={loadingData}>
                    {loadingData ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}

              {/* Cet appareil */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      localEndpoint ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {localEndpoint ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">Cet appareil</h3>
                    <p className="text-xs text-zinc-500">
                      {localEndpoint ? "Notifications actives" : "Non abonné"}
                    </p>
                  </div>
                  {localEndpoint && <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">Actif</Badge>}
                </div>

                {localEndpoint ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                      {testing ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-3.5 w-3.5" />
                      )}
                      Envoyer une notification de test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDisableThisDevice}
                      disabled={disabling}
                      className="text-red-400 hover:text-red-400"
                    >
                      {disabling ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <BellOff className="mr-2 h-3.5 w-3.5" />
                      )}
                      Désactiver sur cet appareil
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={subscribeThisDevice} disabled={!config}>
                    <Bell className="mr-2 h-3.5 w-3.5" />
                    Réactiver sur cet appareil
                  </Button>
                )}
              </div>

              {/* Autres appareils */}
              {pushState && pushState.subscriptions.filter((s) => s.endpoint !== localEndpoint).length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <h3 className="mb-1 text-sm font-semibold">Autres appareils</h3>
                  <p className="mb-4 text-xs text-zinc-500">
                    Chaque appareil doit être activé individuellement pour recevoir des notifications.
                  </p>
                  <div className="space-y-2">
                    {pushState.subscriptions
                      .filter((s) => s.endpoint !== localEndpoint)
                      .map((row) => {
                        const Icon = iconForUserAgent(row.userAgent);
                        return (
                          <div
                            key={row.id}
                            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-zinc-200">
                                {labelForUserAgent(row.userAgent)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                Ajouté le {formatDate(row.createdAt)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveDevice(row)}
                              disabled={removingId === row.id}
                              className="shrink-0 text-red-400 hover:text-red-400"
                            >
                              {removingId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Préférences */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Types de notifications</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400">
                    <Users className="h-3 w-3" />
                    Par compte
                  </span>
                </div>
                <p className="mb-4 flex items-start gap-1.5 text-xs leading-relaxed text-zinc-500">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  Ces réglages s'appliquent à votre compte, donc à tous vos appareils abonnés — pas
                  seulement celui-ci.
                </p>
                <div>
                  {EVENT_TYPES.map((event) => (
                    <ToggleRow
                      key={event.key}
                      label={event.label}
                      checked={pushState?.preferences?.[event.key] ?? true}
                      saving={savingPref === event.key}
                      onToggle={() => handleTogglePreference(event.key)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
