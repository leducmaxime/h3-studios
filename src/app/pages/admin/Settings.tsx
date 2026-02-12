"use client";

import { useState } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  Clock,
  Bell,
  Mail,
  Globe,
  Lock,
  Save,
  Info,
} from "lucide-react";

interface SettingsState {
  businessHours: {
    weekday: { open: string; close: string };
    weekend: { open: string; close: string };
  };
  notifications: {
    emailOnBooking: boolean;
    emailOnCancellation: boolean;
    emailOnPayment: boolean;
  };
  booking: {
    minAdvanceHours: number;
    maxAdvanceDays: number;
    requirePhone: boolean;
    allowCashPayment: boolean;
  };
}

export function AdminSettings() {
  const [settings, setSettings] = useState<SettingsState>({
    businessHours: {
      weekday: { open: "10:00", close: "22:00" },
      weekend: { open: "10:00", close: "22:00" },
    },
    notifications: {
      emailOnBooking: true,
      emailOnCancellation: true,
      emailOnPayment: false,
    },
    booking: {
      minAdvanceHours: 2,
      maxAdvanceDays: 30,
      requirePhone: true,
      allowCashPayment: true,
    },
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Paramètres</h1>
            <p className="text-zinc-400">Configuration générale du système</p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-black transition-colors hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {saved ? "Enregistré !" : "Enregistrer"}
          </button>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-400">Mode démonstration</p>
            <p className="text-sm text-blue-300/70">
              Cette page de paramètres est une maquette. Dans une version complète, 
              ces paramètres seraient connectés à une base de données.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Horaires d'ouverture</h2>
                <p className="text-sm text-zinc-400">Heures de fonctionnement</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Lundi - Vendredi</label>
                <div className="flex items-center gap-3">
                  <input
                    id="weekday-open"
                    type="time"
                    value={settings.businessHours.weekday.open}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        businessHours: {
                          ...settings.businessHours,
                          weekday: { ...settings.businessHours.weekday, open: e.target.value },
                        },
                      })
                    }
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                  />
                  <span className="text-zinc-400">à</span>
                  <input
                    id="weekday-close"
                    type="time"
                    value={settings.businessHours.weekday.close}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        businessHours: {
                          ...settings.businessHours,
                          weekday: { ...settings.businessHours.weekday, close: e.target.value },
                        },
                      })
                    }
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                  />
                </div>
              </div>
              
              <div>
                <label className="mb-2 block text-sm font-medium">Samedi - Dimanche</label>
                <div className="flex items-center gap-3">
                  <input
                    id="weekend-open"
                    type="time"
                    value={settings.businessHours.weekend.open}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        businessHours: {
                          ...settings.businessHours,
                          weekend: { ...settings.businessHours.weekend, open: e.target.value },
                        },
                      })
                    }
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                  />
                  <span className="text-zinc-400">à</span>
                  <input
                    id="weekend-close"
                    type="time"
                    value={settings.businessHours.weekend.close}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        businessHours: {
                          ...settings.businessHours,
                          weekend: { ...settings.businessHours.weekend, close: e.target.value },
                        },
                      })
                    }
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Notifications</h2>
                <p className="text-sm text-zinc-400">Alertes par email</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded-lg border border-zinc-700 p-3 cursor-pointer hover:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-zinc-400" />
                  <span>Nouvelle réservation</span>
                </div>
                <input
                  id="notify-booking"
                  type="checkbox"
                  checked={settings.notifications.emailOnBooking}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailOnBooking: e.target.checked },
                    })
                  }
                  className="h-5 w-5 rounded border-zinc-600 bg-zinc-700 text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-700 p-3 cursor-pointer hover:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-zinc-400" />
                  <span>Annulation</span>
                </div>
                <input
                  id="notify-cancellation"
                  type="checkbox"
                  checked={settings.notifications.emailOnCancellation}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailOnCancellation: e.target.checked },
                    })
                  }
                  className="h-5 w-5 rounded border-zinc-600 bg-zinc-700 text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-700 p-3 cursor-pointer hover:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-zinc-400" />
                  <span>Paiement reçu</span>
                </div>
                <input
                  id="notify-payment"
                  type="checkbox"
                  checked={settings.notifications.emailOnPayment}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, emailOnPayment: e.target.checked },
                    })
                  }
                  className="h-5 w-5 rounded border-zinc-600 bg-zinc-700 text-primary focus:ring-primary"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Règles de réservation</h2>
                <p className="text-sm text-zinc-400">Contraintes de réservation</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Délai minimum (heures)</label>
                <input
                  id="min-advance-hours"
                  type="number"
                  min="0"
                  max="72"
                  value={settings.booking.minAdvanceHours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      booking: { ...settings.booking, minAdvanceHours: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                />
                <p className="mt-1 text-xs text-zinc-500">Temps minimum avant le début de la session</p>
              </div>
              
              <div>
                <label className="mb-2 block text-sm font-medium">Réservation max (jours)</label>
                <input
                  id="max-advance-days"
                  type="number"
                  min="1"
                  max="365"
                  value={settings.booking.maxAdvanceDays}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      booking: { ...settings.booking, maxAdvanceDays: parseInt(e.target.value) || 30 },
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                />
                <p className="mt-1 text-xs text-zinc-500">Nombre de jours à l'avance max</p>
              </div>
              
              <label className="flex items-center justify-between rounded-lg border border-zinc-700 p-3 cursor-pointer hover:bg-zinc-800/50">
                <span>Téléphone obligatoire</span>
                <input
                  id="require-phone"
                  type="checkbox"
                  checked={settings.booking.requirePhone}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      booking: { ...settings.booking, requirePhone: e.target.checked },
                    })
                  }
                  className="h-5 w-5 rounded border-zinc-600 bg-zinc-700 text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-700 p-3 cursor-pointer hover:bg-zinc-800/50">
                <span>Autoriser paiement espèces</span>
                <input
                  id="allow-cash"
                  type="checkbox"
                  checked={settings.booking.allowCashPayment}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      booking: { ...settings.booking, allowCashPayment: e.target.checked },
                    })
                  }
                  className="h-5 w-5 rounded border-zinc-600 bg-zinc-700 text-primary focus:ring-primary"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Sécurité</h2>
                <p className="text-sm text-zinc-400">Accès et authentification</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="rounded-lg border border-zinc-700 p-4 bg-zinc-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Accès admin</span>
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">Actif</span>
                </div>
                <p className="text-sm text-zinc-400">
                  Mode démo - pas d'authentification requise
                </p>
              </div>
              
              <button
                disabled
                className="w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-500 cursor-not-allowed"
              >
                Changer le mot de passe (désactivé en démo)
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
