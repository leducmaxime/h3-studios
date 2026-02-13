"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Euro,
  Pencil,
  Save,
  X,
  Loader2,
  Sun,
  Moon,
  Info,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Percent,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STUDIOS, type StudioId } from "@/lib/booking";
import { type DbPricing, type DbPromoCode } from "@/lib/db-types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricingRow {
  id: string;
  studioId: string;
  groupType: string;
  isPeak: boolean;
  price: number;
}

interface PromoFormData {
  code: string;
  type: "percentage" | "fixed";
  value: string;
  min_total: string;
  expires_at: string;
  max_usage: string;
}

const EMPTY_FORM: PromoFormData = {
  code: "",
  type: "percentage",
  value: "",
  min_total: "",
  expires_at: "",
  max_usage: "",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

const GROUP_ORDER = ["solo", "duo", "group"];

function formatPriceLocal(cents: number): string {
  return `${cents}€`;
}

function transformPricing(rows: DbPricing[]): PricingRow[] {
  return rows.map((row) => ({
    id: row.id,
    studioId: row.studio_id,
    groupType: row.group_type,
    isPeak: row.is_peak === 1,
    price: row.price_per_half_hour,
  }));
}

function formatPromoValue(promo: DbPromoCode): string {
  return promo.type === "percentage" ? `${promo.value}%` : `${promo.value}€`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── PricingTab Component ────────────────────────────────────────────────────

function PricingTab() {
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Map<string, number>>(new Map());

  const fetchPricing = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pricing");
      if (!res.ok) throw new Error("Failed to fetch pricing");

      const json = (await res.json()) as { success: boolean; data: DbPricing[] };
      if (json.success) {
        setPricingRows(transformPricing(json.data));
      }
    } catch (error) {
      console.error("Failed to fetch pricing:", error);
      toast.error("Erreur lors du chargement des tarifs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleStartEdit = () => {
    setEditing(true);
    setEditedPrices(new Map());
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedPrices(new Map());
  };

  const handlePriceChange = (id: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;

    setEditedPrices((prev) => {
      const next = new Map(prev);
      next.set(id, numValue);
      return next;
    });
  };

  const handleSave = async () => {
    if (editedPrices.size === 0) {
      toast.info("Aucune modification à sauvegarder");
      setEditing(false);
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const [id, price] of editedPrices.entries()) {
      try {
        const res = await fetch(`/api/admin/pricing/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price }),
        });

        const json = (await res.json()) as { success: boolean; error?: string };
        if (json.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Failed to update pricing ${id}:`, json.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`Failed to update pricing ${id}:`, error);
      }
    }

    if (errorCount === 0) {
      toast.success(`${successCount} tarif${successCount > 1 ? "s" : ""} mis à jour`);
    } else {
      toast.error(`${errorCount} erreur${errorCount > 1 ? "s" : ""} lors de la sauvegarde`);
    }

    setEditing(false);
    setEditedPrices(new Map());
    setSaving(false);
    fetchPricing();
  };

  const getPrice = (studioId: string, groupType: string, isPeak: boolean): PricingRow | undefined => {
    return pricingRows.find(
      (r) => r.studioId === studioId && r.groupType === groupType && r.isPeak === isPeak,
    );
  };

  const getDisplayPrice = (row: PricingRow | undefined): number => {
    if (!row) return 0;
    if (editing && editedPrices.has(row.id)) {
      return editedPrices.get(row.id)!;
    }
    return row.price;
  };

  const studioEntries = Object.entries(STUDIOS) as [StudioId, (typeof STUDIOS)[StudioId]][];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-zinc-400">Prix par studio, groupe et créneau</p>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Sauvegarder
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleStartEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Modifier les prix
            </Button>
          )}
        </div>
      </div>

      {/* Pricing tables per studio */}
      {studioEntries.map(([studioId, studio]) => (
        <div
          key={studioId}
          className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-primary/20 to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Euro className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{studio.name}</h2>
                <p className="text-sm text-zinc-400">{studio.size} — Prix par demi-heure</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                  <th className="px-6 py-3 font-medium">Type de groupe</th>
                  <th className="px-6 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-zinc-500" />
                      Heures creuses
                    </div>
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-primary" />
                      Heures pleines
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {GROUP_ORDER.map((groupType) => {
                  const offPeakRow = getPrice(studioId, groupType, false);
                  const peakRow = getPrice(studioId, groupType, true);

                  return (
                    <tr
                      key={groupType}
                      className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="px-6 py-4">
                        <Badge variant="secondary">{GROUP_LABELS[groupType]}</Badge>
                      </td>

                      <td className="px-6 py-4">
                        {editing && offPeakRow ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={getDisplayPrice(offPeakRow)}
                              onChange={(e) => handlePriceChange(offPeakRow.id, e.target.value)}
                              className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-sm text-zinc-500">€/½h</span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium tabular-nums">
                            {formatPriceLocal(getDisplayPrice(offPeakRow))}/½h
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {editing && peakRow ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={getDisplayPrice(peakRow)}
                              onChange={(e) => handlePriceChange(peakRow.id, e.target.value)}
                              className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-sm text-zinc-500">€/½h</span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium tabular-nums">
                            {formatPriceLocal(getDisplayPrice(peakRow))}/½h
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Peak hours definition */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Définition des heures pleines / creuses</h2>
              <p className="text-sm text-zinc-400">Règles actuelles de tarification</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sun className="h-5 w-5 text-zinc-400" />
                <h3 className="font-medium">Heures creuses</h3>
              </div>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-2">
                  <span>Lundi → Vendredi</span>
                  <Badge variant="outline">10h — 18h</Badge>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Moon className="h-5 w-5 text-primary" />
                <h3 className="font-medium">Heures pleines</h3>
              </div>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-2">
                  <span>Lundi → Vendredi</span>
                  <Badge variant="default">18h — Fermeture</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-2">
                  <span>Samedi & Dimanche</span>
                  <Badge variant="default">Toute la journée</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <p className="text-xs text-zinc-500">
              La distinction heures pleines / creuses est déterminée par l&apos;heure de début du
              créneau (≥ 18h en semaine) et le jour (samedi et dimanche = heures pleines toute la
              journée). Cette logique est définie dans le code source.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PromoCodeDialog Component ───────────────────────────────────────────────

function PromoCodeDialog({
  open,
  onOpenChange,
  editingPromo,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPromo: DbPromoCode | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PromoFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isEditing = editingPromo !== null;

  useEffect(() => {
    if (open && editingPromo) {
      setForm({
        code: editingPromo.code,
        type: editingPromo.type,
        value: String(editingPromo.value),
        min_total: editingPromo.min_total ? String(editingPromo.min_total) : "",
        expires_at: editingPromo.expires_at ? editingPromo.expires_at.slice(0, 10) : "",
        max_usage: editingPromo.max_usage ? String(editingPromo.max_usage) : "",
      });
    } else if (open) {
      setForm(EMPTY_FORM);
    }
  }, [open, editingPromo]);

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      toast.error("Le code est requis");
      return;
    }
    if (!form.value || parseFloat(form.value) <= 0) {
      toast.error("La valeur doit être supérieure à 0");
      return;
    }
    if (form.type === "percentage" && parseFloat(form.value) > 100) {
      toast.error("Le pourcentage ne peut pas dépasser 100%");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: parseFloat(form.value),
      };
      if (form.min_total) payload.min_total = parseFloat(form.min_total);
      if (form.expires_at) payload.expires_at = form.expires_at;
      if (form.max_usage) payload.max_usage = parseInt(form.max_usage, 10);

      const url = isEditing
        ? `/api/admin/promo-codes/${editingPromo.id}`
        : "/api/admin/promo-codes";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(isEditing ? "Code promo mis à jour" : "Code promo créé");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(json.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Promo code save error:", error);
      toast.error("Erreur lors de la sauvegarde du code promo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le code promo" : "Nouveau code promo"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifiez les paramètres du code promo."
              : "Créez un nouveau code promotionnel pour vos clients."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Code */}
          <div className="space-y-2">
            <Label htmlFor="promo-code">Code</Label>
            <Input
              id="promo-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="SUMMER25"
              className="uppercase"
            />
            <p className="text-xs text-zinc-500">Sera automatiquement converti en majuscules</p>
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type de réduction</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "percentage" | "fixed" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                  <SelectItem value="fixed">Montant fixe (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promo-value">
                Valeur {form.type === "percentage" ? "(%)" : "(€)"}
              </Label>
              <Input
                id="promo-value"
                type="number"
                min={0}
                max={form.type === "percentage" ? 100 : undefined}
                step={form.type === "percentage" ? 1 : 0.5}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.type === "percentage" ? "10" : "5"}
              />
            </div>
          </div>

          {/* Min total */}
          <div className="space-y-2">
            <Label htmlFor="promo-min">Montant minimum d&apos;achat (€)</Label>
            <Input
              id="promo-min"
              type="number"
              min={0}
              step={1}
              value={form.min_total}
              onChange={(e) => setForm((f) => ({ ...f, min_total: e.target.value }))}
              placeholder="Optionnel"
            />
          </div>

          {/* Expiration + Max usage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="promo-expires">Date d&apos;expiration</Label>
              <Input
                id="promo-expires"
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="promo-max-usage">Utilisations max</Label>
              <Input
                id="promo-max-usage"
                type="number"
                min={1}
                value={form.max_usage}
                onChange={(e) => setForm((f) => ({ ...f, max_usage: e.target.value }))}
                placeholder="Illimité"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sauvegarde...
              </>
            ) : isEditing ? (
              <>
                <Save className="mr-2 h-4 w-4" />
                Mettre à jour
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Créer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PromoCodesTab Component ─────────────────────────────────────────────────

function PromoCodesTab() {
  const [promoCodes, setPromoCodes] = useState<DbPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<DbPromoCode | null>(null);

  const fetchPromoCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promo-codes");
      if (!res.ok) throw new Error("Failed to fetch promo codes");

      const json = (await res.json()) as { success: boolean; data: DbPromoCode[] };
      if (json.success) {
        setPromoCodes(json.data);
      }
    } catch (error) {
      console.error("Failed to fetch promo codes:", error);
      toast.error("Erreur lors du chargement des codes promo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromoCodes();
  }, [fetchPromoCodes]);

  const handleToggleActive = async (promo: DbPromoCode) => {
    try {
      const res = await fetch(`/api/admin/promo-codes/${promo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: promo.is_active === 1 ? 0 : 1 }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(
          promo.is_active === 1
            ? `Code "${promo.code}" désactivé`
            : `Code "${promo.code}" activé`,
        );
        fetchPromoCodes();
      } else {
        toast.error(json.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Toggle promo code error:", error);
      toast.error("Erreur lors de la mise à jour du code promo");
    }
  };

  const handleDelete = async (promo: DbPromoCode) => {
    try {
      const res = await fetch(`/api/admin/promo-codes/${promo.id}`, {
        method: "DELETE",
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(`Code "${promo.code}" supprimé`);
        fetchPromoCodes();
      } else {
        toast.error(json.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Delete promo code error:", error);
      toast.error("Erreur lors de la suppression du code promo");
    }
  };

  const handleEdit = (promo: DbPromoCode) => {
    setEditingPromo(promo);
    setDialogOpen(true);
  };

  const handleNewPromo = () => {
    setEditingPromo(null);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-zinc-400">Gérez les codes promotionnels de vos studios</p>
        <Button onClick={handleNewPromo}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau code promo
        </Button>
      </div>

      {/* Promo codes table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {promoCodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
              <Tag className="h-7 w-7 text-zinc-500" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300">Aucun code promo</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Créez votre premier code promotionnel pour attirer de nouveaux clients.
            </p>
            <Button onClick={handleNewPromo} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Créer un code promo
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Réduction</th>
                  <th className="px-6 py-3 font-medium">Min. achat</th>
                  <th className="px-6 py-3 font-medium">Expiration</th>
                  <th className="px-6 py-3 font-medium">Utilisations</th>
                  <th className="px-6 py-3 font-medium">Statut</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((promo) => {
                  const isExpired = promo.expires_at
                    ? new Date(promo.expires_at) < new Date()
                    : false;
                  const isMaxUsed = promo.max_usage !== null
                    ? promo.usage_count >= promo.max_usage
                    : false;

                  return (
                    <tr
                      key={promo.id}
                      className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                    >
                      {/* Code */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                            {promo.type === "percentage" ? (
                              <Percent className="h-4 w-4" />
                            ) : (
                              <Euro className="h-4 w-4" />
                            )}
                          </div>
                          <span className="font-mono text-sm font-semibold tracking-wider">
                            {promo.code}
                          </span>
                        </div>
                      </td>

                      {/* Réduction */}
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium tabular-nums text-primary">
                          -{formatPromoValue(promo)}
                        </span>
                      </td>

                      {/* Min achat */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-zinc-400 tabular-nums">
                          {promo.min_total > 0 ? `${promo.min_total}€` : "—"}
                        </span>
                      </td>

                      {/* Expiration */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm tabular-nums ${isExpired ? "text-red-400" : "text-zinc-400"}`}
                        >
                          {formatDate(promo.expires_at)}
                        </span>
                        {isExpired && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            Expiré
                          </Badge>
                        )}
                      </td>

                      {/* Utilisations */}
                      <td className="px-6 py-4">
                        <span className="text-sm tabular-nums text-zinc-400">
                          {promo.usage_count}
                          {promo.max_usage !== null ? ` / ${promo.max_usage}` : ""}
                        </span>
                        {isMaxUsed && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Épuisé
                          </Badge>
                        )}
                      </td>

                      {/* Statut */}
                      <td className="px-6 py-4">
                        {promo.is_active === 1 ? (
                          <Badge variant="default">Actif</Badge>
                        ) : (
                          <Badge variant="outline">Inactif</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(promo)}
                            title={promo.is_active === 1 ? "Désactiver" : "Activer"}
                          >
                            {promo.is_active === 1 ? (
                              <ToggleRight className="h-4 w-4 text-green-400" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-zinc-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(promo)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(promo)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog */}
      <PromoCodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingPromo={editingPromo}
        onSaved={fetchPromoCodes}
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AdminPricing() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Tarification</h1>
        <p className="text-zinc-400">Gestion des prix et codes promotionnels</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pricing">
        <TabsList>
          <TabsTrigger value="pricing">
            <Euro className="mr-1.5 h-4 w-4" />
            Tarifs
          </TabsTrigger>
          <TabsTrigger value="promo">
            <Tag className="mr-1.5 h-4 w-4" />
            Codes Promo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing">
          <PricingTab />
        </TabsContent>

        <TabsContent value="promo">
          <PromoCodesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
