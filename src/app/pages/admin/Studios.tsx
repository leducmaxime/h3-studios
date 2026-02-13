"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  Music,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { STUDIOS, TIME_SLOTS, type StudioId } from "@/lib/booking";
import { type DbBlockedSlot, type DbPricing } from "@/lib/db-types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BlockForm {
  studioId: StudioId | "";
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

interface PricingByStudio {
  [studioId: string]: {
    [groupType: string]: { peak: number; offPeak: number };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function formatPriceLocal(cents: number): string {
  return `${cents}\u20AC`;
}

function buildPricingMap(rows: DbPricing[]): PricingByStudio {
  const map: PricingByStudio = {};
  for (const row of rows) {
    if (!map[row.studio_id]) map[row.studio_id] = {};
    if (!map[row.studio_id][row.group_type]) {
      map[row.studio_id][row.group_type] = { peak: 0, offPeak: 0 };
    }
    if (row.is_peak) {
      map[row.studio_id][row.group_type].peak = row.price_per_half_hour;
    } else {
      map[row.studio_id][row.group_type].offPeak = row.price_per_half_hour;
    }
  }
  return map;
}

const GROUP_LABELS: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

const INITIAL_BLOCK_FORM: BlockForm = {
  studioId: "",
  date: new Date().toISOString().slice(0, 10),
  startTime: "10:00",
  endTime: "00:00",
  reason: "",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminStudios() {
  const [blockedSlots, setBlockedSlots] = useState<DbBlockedSlot[]>([]);
  const [pricing, setPricing] = useState<PricingByStudio>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockForm>(INITIAL_BLOCK_FORM);

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [slotsRes, pricingRes] = await Promise.all([
        fetch("/api/admin/blocked-slots"),
        fetch("/api/admin/pricing"),
      ]);

      if (slotsRes.ok) {
        const slotsJson = await slotsRes.json() as { success: boolean; data: DbBlockedSlot[] };
        if (slotsJson.success) setBlockedSlots(slotsJson.data);
      }

      if (pricingRes.ok) {
        const pricingJson = await pricingRes.json() as { success: boolean; data: DbPricing[] };
        if (pricingJson.success) setPricing(buildPricingMap(pricingJson.data));
      }
    } catch (error) {
      console.error("Failed to fetch studios data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleAddBlock = async () => {
    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    if (!blockForm.reason.trim()) {
      toast.error("Veuillez indiquer une raison");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studio_id: blockForm.studioId || null,
          date: blockForm.date,
          start_time: blockForm.startTime,
          end_time: blockForm.endTime,
          reason: blockForm.reason,
        }),
      });

      const json = await res.json() as { success: boolean; error?: string };

      if (json.success) {
        toast.success("Créneau bloqué avec succès");
        setDialogOpen(false);
        setBlockForm(INITIAL_BLOCK_FORM);
        fetchData();
      } else {
        toast.error(json.error || "Erreur lors du blocage");
      }
    } catch (error) {
      console.error("Failed to add blocked slot:", error);
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveBlock = async (slotId: string) => {
    try {
      const res = await fetch(`/api/admin/blocked-slots/${slotId}`, {
        method: "DELETE",
      });

      const json = await res.json() as { success: boolean; error?: string };

      if (json.success) {
        toast.success("Blocage supprimé");
        fetchData();
      } else {
        toast.error(json.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Failed to remove blocked slot:", error);
      toast.error("Erreur réseau");
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Derived data ─────────────────────────────────────────────────────

  const studioEntries = Object.entries(STUDIOS) as [StudioId, typeof STUDIOS[StudioId]][];
  const today = new Date().toISOString().slice(0, 10);
  const upcomingBlocks = blockedSlots
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Studios</h1>
          <p className="text-zinc-400">Configuration des studios et blocages</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Bloquer un créneau
        </Button>
      </div>

      {/* Studio cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {studioEntries.map(([id, studio]) => {
          const studioPricing = pricing[id] || {};
          return (
            <div
              key={id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
            >
              {/* Studio header */}
              <div className="bg-gradient-to-r from-primary/20 to-transparent p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{studio.name}</h2>
                    <p className="text-zinc-400">{studio.size}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Features as Badges */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Caractéristiques</h3>
                  <div className="flex flex-wrap gap-2">
                    {studio.features.map((feature: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        <Music className="h-3 w-3" />
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Pricing from D1 */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">Tarifs (par demi-heure)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(["solo", "duo", "group"] as const).map((groupType) => {
                      const prices = studioPricing[groupType];
                      if (!prices) return null;
                      return (
                        <div key={groupType} className="rounded-lg border border-zinc-700 p-3">
                          <p className="text-xs text-zinc-500">{GROUP_LABELS[groupType]}</p>
                          <p className="font-medium">{formatPriceLocal(prices.peak)}/\u00BDh</p>
                          <p className="text-xs text-zinc-500">HC: {formatPriceLocal(prices.offPeak)}/\u00BDh</p>
                        </div>
                      );
                    })}
                    <div className="rounded-lg border border-zinc-700 p-3 bg-zinc-800/50">
                      <p className="text-xs text-zinc-500">Heures creuses</p>
                      <p className="text-sm text-zinc-400">10h-18h en semaine</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Blocked slots list */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-4">
          <h2 className="font-semibold">Créneaux bloqués</h2>
          <p className="text-sm text-zinc-400">Créneaux indisponibles à la réservation</p>
        </div>

        {upcomingBlocks.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <Calendar className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>Aucun créneau bloqué</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {upcomingBlocks.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center gap-4 p-4 hover:bg-zinc-800/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {slot.studio_id ? STUDIOS[slot.studio_id as StudioId]?.name ?? slot.studio_id : "Tous les studios"}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Calendar className="h-4 w-4" />
                    {formatDateShort(slot.date)}
                    <Clock className="ml-2 h-4 w-4" />
                    {slot.start_time} - {slot.end_time}
                  </div>
                  {slot.reason && (
                    <p className="mt-1 text-sm text-zinc-500">{slot.reason}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveBlock(slot.id)}
                  className="text-zinc-400 hover:text-red-400"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Block slot dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Bloquer un créneau</DialogTitle>
            <DialogDescription>
              Rendez un créneau indisponible à la réservation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Studio</label>
              <select
                value={blockForm.studioId}
                onChange={(e) => setBlockForm({ ...blockForm, studioId: e.target.value as StudioId | "" })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              >
                <option value="">Tous les studios</option>
                {studioEntries.map(([id, studio]) => (
                  <option key={id} value={id}>{studio.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">Date</label>
              <input
                type="date"
                value={blockForm.date}
                onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Début</label>
                <select
                  value={blockForm.startTime}
                  onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                >
                  {TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Fin</label>
                <select
                  value={blockForm.endTime}
                  onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                >
                  {[...TIME_SLOTS.slice(1), "00:00"].map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">Raison</label>
              <input
                type="text"
                value={blockForm.reason}
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                placeholder="ex: Maintenance, Événement privé..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddBlock}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Blocage...
                </>
              ) : (
                "Bloquer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
