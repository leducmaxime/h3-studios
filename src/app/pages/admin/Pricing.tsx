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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STUDIOS, type StudioId } from "@/lib/booking";
import { type DbPricing } from "@/lib/db-types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricingRow {
  id: string;
  studioId: string;
  groupType: string;
  isPeak: boolean;
  price: number;
}

interface EditedPrice {
  id: string;
  price: number;
}

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

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminPricing() {
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Map<string, number>>(new Map());

  // ─── Data fetching ──────────────────────────────────────────────────────

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

  // ─── Handlers ─────────────────────────────────────────────────────────

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

  // ─── Derived data ─────────────────────────────────────────────────────

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

  // ─── Loading state ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarification</h1>
          <p className="text-zinc-400">Gestion des prix par studio, groupe et créneau</p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={saving}
              >
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
          {/* Studio header */}
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

          {/* Pricing table */}
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
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{GROUP_LABELS[groupType]}</Badge>
                        </div>
                      </td>

                      {/* Off-peak price */}
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

                      {/* Peak price */}
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
            {/* Off-peak definition */}
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

            {/* Peak definition */}
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
