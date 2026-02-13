"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Shield,
  Save,
  UserPlus,
  UserX,
  UserCheck,
  Loader2,
  Phone,
  Banknote,
  CalendarClock,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SettingValue {
  key: string;
  value: string;
}

interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: "super-admin" | "operator";
  is_active: number;
  created_at: string;
}

interface CurrentUser {
  id: string;
  role: "super-admin" | "operator";
}

function parseSettingsMap(settings: SettingValue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return map;
}

async function saveSetting(key: string, value: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    if (!json.success) {
      toast.error(json.error || "Erreur lors de la sauvegarde");
      return false;
    }
    return true;
  } catch {
    toast.error("Erreur réseau");
    return false;
  }
}

function BookingRulesTab({ settings, onUpdate }: {
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}) {
  const [minAdvanceHours, setMinAdvanceHours] = useState(settings["booking.min_advance_hours"] || "2");
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(settings["booking.max_advance_days"] || "30");
  const [requirePhone, setRequirePhone] = useState(settings["booking.require_phone"] !== "false");
  const [allowCash, setAllowCash] = useState(settings["booking.allow_cash"] !== "false");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setMinAdvanceHours(settings["booking.min_advance_hours"] || "2");
    setMaxAdvanceDays(settings["booking.max_advance_days"] || "30");
    setRequirePhone(settings["booking.require_phone"] !== "false");
    setAllowCash(settings["booking.allow_cash"] !== "false");
  }, [settings]);

  const persistSetting = async (key: string, value: string) => {
    setSaving(key);
    const ok = await saveSetting(key, value);
    if (ok) {
      onUpdate(key, value);
      toast.success("Paramètre enregistré");
    }
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Délai minimum</h3>
              <p className="text-xs text-zinc-500">Heures avant le début de session</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              max={72}
              value={minAdvanceHours}
              onChange={(e) => setMinAdvanceHours(e.target.value)}
              className="w-24 bg-zinc-800 border-zinc-700"
            />
            <span className="text-sm text-zinc-400">heures</span>
            <Button
              size="sm"
              onClick={() => persistSetting("booking.min_advance_hours", minAdvanceHours)}
              disabled={saving === "booking.min_advance_hours"}
              className="ml-auto"
            >
              {saving === "booking.min_advance_hours" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Réservation max à l'avance</h3>
              <p className="text-xs text-zinc-500">Durée maximum en jours</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={365}
              value={maxAdvanceDays}
              onChange={(e) => setMaxAdvanceDays(e.target.value)}
              className="w-24 bg-zinc-800 border-zinc-700"
            />
            <span className="text-sm text-zinc-400">jours</span>
            <Button
              size="sm"
              onClick={() => persistSetting("booking.max_advance_days", maxAdvanceDays)}
              disabled={saving === "booking.max_advance_days"}
              className="ml-auto"
            >
              {saving === "booking.max_advance_days" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleCard
          icon={<Phone className="h-4 w-4" />}
          label="Téléphone obligatoire"
          description="Exiger le numéro de téléphone lors de la réservation"
          checked={requirePhone}
          saving={saving === "booking.require_phone"}
          onToggle={async () => {
            const newVal = !requirePhone;
            setRequirePhone(newVal);
            setSaving("booking.require_phone");
            const ok = await saveSetting("booking.require_phone", String(newVal));
            if (ok) {
              onUpdate("booking.require_phone", String(newVal));
              toast.success("Paramètre enregistré");
            } else {
              setRequirePhone(!newVal);
            }
            setSaving(null);
          }}
        />

        <ToggleCard
          icon={<Banknote className="h-4 w-4" />}
          label="Paiement espèces"
          description="Autoriser le paiement en espèces sur place"
          checked={allowCash}
          saving={saving === "booking.allow_cash"}
          onToggle={async () => {
            const newVal = !allowCash;
            setAllowCash(newVal);
            setSaving("booking.allow_cash");
            const ok = await saveSetting("booking.allow_cash", String(newVal));
            if (ok) {
              onUpdate("booking.allow_cash", String(newVal));
              toast.success("Paramètre enregistré");
            } else {
              setAllowCash(!newVal);
            }
            setSaving(null);
          }}
        />
      </div>
    </div>
  );
}

function ToggleCard({ icon, label, description, checked, saving, onToggle }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
        checked
          ? "border-primary/30 bg-primary/5"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      } ${saving ? "opacity-60" : ""}`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        checked ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500"
      }`}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-zinc-700"
      }`}>
        <div className={`h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5.5" : "translate-x-0.5"
        }`} />
      </div>
    </button>
  );
}

function SecurityTab({ currentUser }: { currentUser: CurrentUser | null }) {
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchAdminUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/admin-users");
      const json = (await res.json()) as { success: boolean; data?: AdminUserRow[] };
      if (json.success && json.data) {
        setAdminUsers(json.data);
      }
    } catch {
      toast.error("Erreur lors du chargement des comptes admin");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  const handleToggle = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast.error("Vous ne pouvez pas désactiver votre propre compte");
      return;
    }

    setToggling(userId);
    try {
      const res = await fetch(`/api/admin/admin-users/${userId}/toggle`, {
        method: "PUT",
      });
      const json = (await res.json()) as { success: boolean; data?: { id: string; is_active: number } };
      if (json.success && json.data) {
        setAdminUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_active: json.data!.is_active } : u)),
        );
        toast.success(json.data.is_active ? "Compte activé" : "Compte désactivé");
      } else {
        toast.error("Erreur lors du changement de statut");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setToggling(null);
    }
  };

  const handleCreated = (newUser: AdminUserRow) => {
    setAdminUsers((prev) => [...prev, newUser]);
    setShowCreateDialog(false);
    toast.success("Opérateur créé avec succès");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Comptes administrateurs</h3>
          <p className="text-xs text-zinc-500">{adminUsers.length} compte(s) au total</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Nouvel opérateur
        </Button>
      </div>

      <div className="space-y-3">
        {adminUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              user.is_active ? "bg-primary/20" : "bg-zinc-800"
            }`}>
              <span className={`text-sm font-semibold ${
                user.is_active ? "text-primary" : "text-zinc-600"
              }`}>
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <Badge variant={user.role === "super-admin" ? "default" : "secondary"}>
                  {user.role === "super-admin" ? "Super Admin" : "Opérateur"}
                </Badge>
                {!user.is_active && (
                  <Badge variant="destructive">Désactivé</Badge>
                )}
              </div>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>

            {user.id !== currentUser?.id && (
              <Button
                size="sm"
                variant={user.is_active ? "outline" : "default"}
                onClick={() => handleToggle(user.id)}
                disabled={toggling === user.id}
              >
                {toggling === user.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : user.is_active ? (
                  <>
                    <UserX className="mr-1.5 h-3.5 w-3.5" />
                    Désactiver
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                    Activer
                  </>
                )}
              </Button>
            )}
          </div>
        ))}
      </div>

      <CreateOperatorDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
      />
    </div>
  );
}

function CreateOperatorDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: AdminUserRow) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPassword("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Tous les champs sont obligatoires");
      return;
    }

    if (password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "operator" }),
      });
      const json = (await res.json()) as { success: boolean; data?: AdminUserRow; error?: string };
      if (json.success && json.data) {
        onCreated({
          ...json.data,
          created_at: new Date().toISOString(),
        });
      } else {
        toast.error(json.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Créer un opérateur</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="op-name">Nom complet</Label>
            <Input
              id="op-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marie Dupont"
              className="mt-1.5 bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label htmlFor="op-email">Email</Label>
            <Input
              id="op-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marie@h3studios.fr"
              className="mt-1.5 bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label htmlFor="op-password">Mot de passe</Label>
            <Input
              id="op-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 caractères"
              className="mt-1.5 bg-zinc-800 border-zinc-700"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings")
        .then((r) => r.json() as Promise<{ success: boolean; data?: SettingValue[] }>)
        .then((json) => {
          if (json.success && json.data) setSettings(parseSettingsMap(json.data));
        }),
      fetch("/api/admin/me")
        .then((r) => r.json() as Promise<{ success: boolean; data?: CurrentUser }>)
        .then((json) => {
          if (json.success && json.data) setCurrentUser(json.data);
        }),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSettingUpdate = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-zinc-400">Configuration du système de réservation</p>
      </div>

      <Tabs defaultValue="booking" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="booking" className="gap-2">
            <Clock className="h-4 w-4" />
            Règles de réservation
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        <TabsContent value="booking" className="mt-6">
          <BookingRulesTab settings={settings} onUpdate={handleSettingUpdate} />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SecurityTab currentUser={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
