"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  CalendarDays,
  CalendarClock,
  CalendarPlus,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Lock,
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
import { type DbPricing, type DbPromoCode, type DbUser } from "@/lib/db-types";
import {
  formatHourlyInput,
  halfHourCentsToHourly,
  MAX_ADMIN_PRICE_PER_HOUR_EUR,
  parsePricePerHour,
} from "@/lib/pricing";
import { groupTypeLabel } from "@/lib/labels";
import { getParisDateISO, isPromoCodeExpired } from "@/lib/utils";
import {
  getLoyaltyCodeStatus,
  loyaltyStatusBadgeProps,
  formatLoyaltyDiscount,
  isLoyaltyCodeResendable,
} from "@/lib/loyalty-code-display";
import { LoyaltyCodeResendButton } from "@/components/admin/LoyaltyCodeResendButton";
import { LoyaltyCodeExpiryEditor } from "@/components/admin/LoyaltyCodeExpiryEditor";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PricingRow {
  id: string;
  studioId: string;
  groupType: string;
  isPeak: boolean;
  pricePerHalfHourCents: number;
  effectiveFrom: string;
}

interface PromoFormData {
  code: string;
  type: "percentage" | "fixed";
  value: string;
  min_total: string;
  expires_at: string;
  max_usage: string;
  round_mode: "down" | "up" | "none";
}

const EMPTY_FORM: PromoFormData = {
  code: "",
  type: "percentage",
  value: "",
  min_total: "",
  expires_at: "",
  max_usage: "",
  round_mode: "none",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const GROUP_ORDER = ["solo", "duo", "group"];

function formatPriceLocal(eurosPerHour: number): string {
  return `${eurosPerHour.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€ TTC`;
}

function transformPricing(rows: DbPricing[]): PricingRow[] {
  return rows.map((row) => ({
    id: row.id,
    studioId: row.studio_id,
    groupType: row.group_type,
    isPeak: row.is_peak === 1,
    pricePerHalfHourCents: row.price_per_half_hour,
    effectiveFrom: row.effective_from,
  }));
}

// ─── Pricing versions helpers ───────────────────────────────────────────────

interface PricingVersion {
  effectiveFrom: string;
  rows: PricingRow[];
}

/**
 * Splits rows into the active grid (latest effective_from <= today) and the
 * scheduled grids (effective_from > today, ascending). Older past dates are
 * historical and never returned.
 */
function splitPricingVersions(
  rows: PricingRow[],
  today: string,
): { active: PricingVersion | null; scheduled: PricingVersion[] } {
  const byDate = new Map<string, PricingRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.effectiveFrom) ?? [];
    list.push(row);
    byDate.set(row.effectiveFrom, list);
  }

  const pastDates = [...byDate.keys()].filter((d) => d <= today).sort();
  const activeDate = pastDates[pastDates.length - 1] ?? null;

  return {
    active: activeDate
      ? { effectiveFrom: activeDate, rows: byDate.get(activeDate)! }
      : null,
    scheduled: [...byDate.keys()]
      .filter((d) => d > today)
      .sort()
      .map((d) => ({ effectiveFrom: d, rows: byDate.get(d)! })),
  };
}

/**
 * Date de rétro-remplissage de la migration 0014 : les tarifs antérieurs au
 * versionnement portent l'epoch Unix. Ce n'est pas une date métier, on ne
 * l'affiche donc jamais telle quelle.
 */
const LEGACY_EFFECTIVE_FROM = "1970-01-01";

function formatEffectiveDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function tomorrowParisISO(): string {
  const [y, m, d] = getParisDateISO().split("-").map(Number);
  return toISO(addDays(new Date(y, m - 1, d), 1));
}

function formatPromoValue(promo: DbPromoCode): string {
  return promo.type === "percentage" ? `${promo.value}%` : `${promo.value}€ TTC`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// Vocabulaire des codes fidélité (statut, portée, éligibilité au renvoi) :
// voir src/lib/loyalty-code-display.ts, partagé avec UserDetail.tsx.

// ─── Public Holidays helpers ────────────────────────────────────────────────

function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function frenchPublicHolidays(year: number): string[] {
  const easter = easterDate(year);
  const fixed = [
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-05-08`,
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ];
  const variable = [
    toISO(addDays(easter, 1)),   // Lundi de Pâques
    toISO(addDays(easter, 39)),  // Ascension
    toISO(addDays(easter, 50)),  // Lundi de Pentecôte
  ];
  return [...fixed, ...variable].sort();
}

function formatHolidayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── PublicHolidaysSection Component ────────────────────────────────────────

function PublicHolidaysSection() {
  const [holidays, setHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState("");

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/public-holidays");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = (await res.json()) as { success: boolean; data: string[] };
      if (json.success) setHolidays(json.data);
    } catch (error) {
      console.error("Failed to fetch public holidays:", error);
      toast.error("Erreur lors du chargement des jours fériés");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const saveHolidays = async (updated: string[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/public-holidays", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const json = (await res.json()) as { success: boolean; data: string[]; error?: string };
      if (json.success) {
        setHolidays(json.data);
      } else {
        toast.error(json.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Failed to save public holidays:", error);
      toast.error("Erreur lors de la sauvegarde des jours fériés");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newDate) return;
    if (holidays.includes(newDate)) {
      toast.info("Cette date est déjà dans la liste");
      return;
    }
    await saveHolidays([...holidays, newDate].sort());
    setNewDate("");
  };

  const handleRemove = async (iso: string) => {
    await saveHolidays(holidays.filter((h) => h !== iso));
  };

  const handleLoadFrench = async (year: number) => {
    const generated = frenchPublicHolidays(year);
    const merged = Array.from(new Set([...holidays, ...generated])).sort();
    await saveHolidays(merged);
    toast.success(`Fériés ${year} chargés`);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Jours fériés</h2>
            <p className="text-sm text-zinc-400">Facturés au tarif week-end (heures pleines)</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLoadFrench(currentYear)}
            disabled={saving}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Fériés français {currentYear}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLoadFrench(currentYear + 1)}
            disabled={saving}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Fériés français {currentYear + 1}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Date du jour férié"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-base lg:text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button size="sm" onClick={handleAdd} disabled={saving || !newDate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : holidays.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">Aucun jour férié enregistré.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {holidays.map((iso) => (
              <div
                key={iso}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-zinc-500 tabular-nums">{iso}</span>
                  <span className="text-sm capitalize text-zinc-300">{formatHolidayDate(iso)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(iso)}
                  disabled={saving}
                  aria-label={`Supprimer le ${formatHolidayDate(iso)}`}
                  className="h-7 w-7 p-0 text-zinc-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          <p className="text-xs text-zinc-500">
            Les jours fériés sont tarifés au même prix que le samedi et le dimanche (heures pleines toute la journée).
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── PeakHoursSection Component ─────────────────────────────────────────────

const PEAK_HOUR_OPTIONS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function PeakHoursSection() {
  const [peakStartHour, setPeakStartHourState] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(18);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/peak-hours")
      .then((r) => r.json() as Promise<{ success: boolean; data: { peakStartHour: number } }>)
      .then((json) => {
        if (json.success) {
          setPeakStartHourState(json.data.peakStartHour);
          setDraft(json.data.peakStartHour);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch peak hours:", error);
        toast.error("Erreur lors du chargement de la configuration");
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/peak-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peakStartHour: draft }),
      });
      const json = (await res.json()) as { success: boolean; data: { peakStartHour: number }; error?: string };
      if (json.success) {
        setPeakStartHourState(json.data.peakStartHour);
        setEditing(false);
        toast.success(`Heure pleine démarrant à ${json.data.peakStartHour}h sauvegardée`);
      } else {
        toast.error(json.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Failed to save peak hours:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const displayHour = editing ? draft : (peakStartHour ?? 18);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Définition des heures pleines / creuses</h2>
              <p className="text-sm text-zinc-400">Heure de début des tarifs pleins en semaine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setDraft(peakStartHour ?? 18); }} disabled={saving}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                  Sauvegarder
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={peakStartHour === null}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Modifier
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sun className="h-5 w-5 text-zinc-400" />
              <h3 className="font-medium">Heures creuses</h3>
            </div>
            <div className="space-y-2 text-sm text-zinc-400">
              <div className="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-2">
                <span>Lundi → Vendredi</span>
                <Badge variant="outline">10h — {displayHour}h</Badge>
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
                {editing ? (
                  <select
                    value={draft}
                    onChange={(e) => setDraft(parseInt(e.target.value, 10))}
                    className="rounded-md border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-white focus:border-primary focus:outline-none"
                  >
                    {PEAK_HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>{h}h — Fermeture</option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="default">{displayHour}h — Fermeture</Badge>
                )}
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
            Les créneaux en semaine à partir de {displayHour}h sont facturés au tarif plein. Les week-ends et jours fériés sont toujours au tarif plein.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── StudioPricingTables Component ──────────────────────────────────────────

function StudioPricingTables({
  rows,
  editing,
  priceDrafts,
  priceErrors,
  onPriceChange,
  onPriceBlur,
}: {
  rows: PricingRow[];
  editing: boolean;
  priceDrafts: Map<string, string>;
  priceErrors: Map<string, string>;
  onPriceChange: (id: string, value: string) => void;
  onPriceBlur: (id: string, value: string) => void;
}) {
  const studioEntries = Object.entries(STUDIOS) as [StudioId, (typeof STUDIOS)[StudioId]][];

  const getPrice = (studioId: string, groupType: string, isPeak: boolean): PricingRow | undefined => {
    return rows.find(
      (r) => r.studioId === studioId && r.groupType === groupType && r.isPeak === isPeak,
    );
  };

  const getDisplayPrice = (row: PricingRow | undefined): number => {
    if (!row) return 0;
    // La base stocke les centimes par demi-heure ; l'interface affiche €/h.
    return halfHourCentsToHourly(row.pricePerHalfHourCents);
  };

  const renderPriceInput = (row: PricingRow) => {
    const error = priceErrors.get(row.id);
    const errorId = `${row.id}-price-error`;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Tarif ${row.groupType} ${row.isPeak ? "heures pleines" : "heures creuses"} en euros par heure`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            value={priceDrafts.get(row.id) ?? formatHourlyInput(row.pricePerHalfHourCents)}
            onChange={(e) => onPriceChange(row.id, e.target.value)}
            onBlur={(e) => onPriceBlur(row.id, e.target.value)}
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-sm text-zinc-500">€/h</span>
        </div>
        {error && <p id={errorId} className="text-xs text-red-400">{error}</p>}
      </div>
    );
  };

  return (
    <>
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
                <p className="text-sm text-zinc-400">
                  {studio.size} — Prix par heure (€/h, virgule ou point, 2 décimales max,
                  plafond {MAX_ADMIN_PRICE_PER_HOUR_EUR} €)
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto scroll-x-touch">
            <table className="w-full min-w-[560px]">
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
                        <Badge variant="secondary">{groupTypeLabel(groupType)}</Badge>
                      </td>

                      <td className="px-6 py-4">
                        {editing && offPeakRow ? (
                          renderPriceInput(offPeakRow)
                        ) : (
                          <span className="text-sm font-medium tabular-nums">
                            {formatPriceLocal(getDisplayPrice(offPeakRow))}/h
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {editing && peakRow ? (
                          renderPriceInput(peakRow)
                        ) : (
                          <span className="text-sm font-medium tabular-nums">
                            {formatPriceLocal(getDisplayPrice(peakRow))}/h
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
    </>
  );
}

// ─── PricingTab Component ────────────────────────────────────────────────────

function PricingTab() {
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFrom, setEditingFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Map<string, number>>(new Map());
  const [priceDrafts, setPriceDrafts] = useState<Map<string, string>>(new Map());
  const [priceErrors, setPriceErrors] = useState<Map<string, string>>(new Map());

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleCells, setScheduleCells] = useState<Map<string, number>>(new Map());
  const [scheduleDrafts, setScheduleDrafts] = useState<Map<string, string>>(new Map());
  const [scheduleErrors, setScheduleErrors] = useState<Map<string, string>>(new Map());
  const [scheduling, setScheduling] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

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

  const today = getParisDateISO();
  const { active, scheduled } = splitPricingVersions(pricingRows, today);
  const isEditingActive = active !== null && editingFrom === active.effectiveFrom;

  const handleStartEdit = (effectiveFrom: string) => {
    setEditingFrom(effectiveFrom);
    setEditedPrices(new Map());
    setPriceDrafts(new Map());
    setPriceErrors(new Map());
  };

  const handleCancelEdit = () => {
    setEditingFrom(null);
    setEditedPrices(new Map());
    setPriceDrafts(new Map());
    setPriceErrors(new Map());
  };

  const handlePriceChange = (id: string, value: string) => {
    const parsed = parsePricePerHour(value);

    setPriceDrafts((prev) => {
      const next = new Map(prev);
      next.set(id, value);
      return next;
    });
    setPriceErrors((prev) => {
      const next = new Map(prev);
      if (parsed.valid) next.delete(id);
      else next.set(id, parsed.error);
      return next;
    });

    setEditedPrices((prev) => {
      const next = new Map(prev);
      if (parsed.valid) next.set(id, parsed.pricePerHalfHourCents);
      else next.delete(id);
      return next;
    });
  };

  const handlePriceBlur = (id: string, value: string) => {
    const parsed = parsePricePerHour(value);
    if (!parsed.valid) return;

    setPriceDrafts((prev) => {
      const next = new Map(prev);
      next.set(id, parsed.normalized);
      return next;
    });
  };

  const handleSave = async () => {
    if (priceErrors.size > 0) {
      toast.error("Corrigez les tarifs signalés avant de sauvegarder.");
      return;
    }
    if (editedPrices.size === 0) {
      toast.info("Aucune modification à sauvegarder");
      setEditingFrom(null);
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const [id, pricePerHalfHourCents] of editedPrices.entries()) {
      try {
        const res = await fetch(`/api/admin/pricing/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price: pricePerHalfHourCents }),
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

    setEditingFrom(null);
    setEditedPrices(new Map());
    setPriceDrafts(new Map());
    setPriceErrors(new Map());
    setSaving(false);
    fetchPricing();
  };

  // ─── Schedule dialog ──────────────────────────────────────────────────────

  const cellKey = (studioId: string, groupType: string, isPeak: boolean) =>
    `${studioId}|${groupType}|${isPeak ? 1 : 0}`;

  const openScheduleDialog = () => {
    if (!active) return;
    const cells = new Map<string, number>();
    for (const row of active.rows) {
      // Pré-remplir avec les centimes par demi-heure de la grille active.
      cells.set(cellKey(row.studioId, row.groupType, row.isPeak), row.pricePerHalfHourCents);
    }
    setScheduleCells(cells);
    setScheduleDrafts(new Map());
    setScheduleErrors(new Map());
    setScheduleDate(tomorrowParisISO());
    setScheduleOpen(true);
  };

  const handleScheduleCellChange = (key: string, value: string) => {
    const parsed = parsePricePerHour(value);
    setScheduleDrafts((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
    setScheduleErrors((prev) => {
      const next = new Map(prev);
      if (parsed.valid) next.delete(key);
      else next.set(key, parsed.error);
      return next;
    });
    setScheduleCells((prev) => {
      const next = new Map(prev);
      if (parsed.valid) next.set(key, parsed.pricePerHalfHourCents);
      else next.delete(key);
      return next;
    });
  };

  const handleScheduleCellBlur = (key: string, value: string) => {
    const parsed = parsePricePerHour(value);
    if (!parsed.valid) return;

    setScheduleDrafts((prev) => {
      const next = new Map(prev);
      next.set(key, parsed.normalized);
      return next;
    });
  };

  const handleSchedule = async () => {
    if (scheduleErrors.size > 0) {
      toast.error("Corrigez les tarifs signalés avant de programmer la grille.");
      return;
    }
    if (!scheduleDate) {
      toast.error("Choisissez une date d'entrée en vigueur");
      return;
    }
    if (scheduleDate <= today) {
      toast.error("La date d'entrée en vigueur doit être postérieure à aujourd'hui");
      return;
    }

    const prices: {
      studio_id: string;
      group_type: string;
      is_peak: number;
      price_per_half_hour: number;
    }[] = [];

    for (const studioId of Object.keys(STUDIOS)) {
      for (const groupType of GROUP_ORDER) {
        for (const isPeak of [false, true]) {
          const pricePerHalfHourCents = scheduleCells.get(cellKey(studioId, groupType, isPeak));
          if (pricePerHalfHourCents === undefined || pricePerHalfHourCents < 0) {
            toast.error("Tous les tarifs doivent être renseignés (montants positifs)");
            return;
          }
          prices.push({
            studio_id: studioId,
            group_type: groupType,
            is_peak: isPeak ? 1 : 0,
            price_per_half_hour: pricePerHalfHourCents,
          });
        }
      }
    }

    setScheduling(true);
    try {
      const res = await fetch("/api/admin/pricing/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effectiveFrom: scheduleDate, prices }),
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(`Grille programmée au ${formatEffectiveDate(scheduleDate)}`);
        setScheduleOpen(false);
        fetchPricing();
      } else {
        toast.error(json.error || "Erreur lors de la programmation");
      }
    } catch (error) {
      console.error("Failed to schedule pricing:", error);
      toast.error("Erreur lors de la programmation de la grille");
    } finally {
      setScheduling(false);
    }
  };

  // ─── Cancel scheduled grid ────────────────────────────────────────────────

  const handleCancelSchedule = async () => {
    if (!cancelTarget) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/pricing/schedule/${cancelTarget}`, {
        method: "DELETE",
      });

      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(`Grille du ${formatEffectiveDate(cancelTarget)} annulée`);
        setCancelTarget(null);
        fetchPricing();
      } else {
        toast.error(json.error || "Erreur lors de l'annulation");
      }
    } catch (error) {
      console.error("Failed to cancel scheduled pricing:", error);
      toast.error("Erreur lors de l'annulation de la grille");
    } finally {
      setCancelling(false);
    }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-zinc-400">Prix par heure selon studio, groupe et créneau</p>
        <div className="flex items-center gap-2">
          {isEditingActive ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving || priceErrors.size > 0}>
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
            <>
              <Button
                variant="outline"
                onClick={() => active && handleStartEdit(active.effectiveFrom)}
                disabled={!active || editingFrom !== null}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Modifier les prix
              </Button>
              <Button onClick={openScheduleDialog} disabled={!active || editingFrom !== null}>
                <CalendarPlus className="mr-2 h-4 w-4" />
                Programmer un changement
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grille active */}
      {active ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Euro className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Tarifs en vigueur</h2>
                <Badge>Grille active</Badge>
              </div>
              <p className="text-sm text-zinc-400">
                {active.effectiveFrom === LEGACY_EFFECTIVE_FROM
                  ? "Grille d'origine, appliquée depuis l'ouverture"
                  : `Appliqués depuis le ${formatEffectiveDate(active.effectiveFrom)}`}
              </p>
            </div>
          </div>

          <StudioPricingTables
            rows={active.rows}
            editing={isEditingActive}
            priceDrafts={priceDrafts}
            priceErrors={priceErrors}
            onPriceChange={handlePriceChange}
            onPriceBlur={handlePriceBlur}
          />
        </section>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-10 text-center">
          <p className="text-sm text-zinc-500 italic">Aucune grille tarifaire active.</p>
        </div>
      )}

      {/* Grilles programmées */}
      {scheduled.map((version) => {
        const isEditingThis = editingFrom === version.effectiveFrom;

        return (
          <section
            key={version.effectiveFrom}
            className="space-y-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.03] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">
                      À partir du {formatEffectiveDate(version.effectiveFrom)}
                    </h2>
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 text-amber-400"
                    >
                      Programmée
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400">
                    Remplacera la grille active à cette date
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEditingThis ? (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Annuler
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving || priceErrors.size > 0}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                          Sauvegarder
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartEdit(version.effectiveFrom)}
                      disabled={editingFrom !== null}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelTarget(version.effectiveFrom)}
                      disabled={editingFrom !== null}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Annuler
                    </Button>
                  </>
                )}
              </div>
            </div>

            <StudioPricingTables
              rows={version.rows}
              editing={isEditingThis}
              priceDrafts={priceDrafts}
              priceErrors={priceErrors}
              onPriceChange={handlePriceChange}
              onPriceBlur={handlePriceBlur}
            />
          </section>
        );
      })}

      <PeakHoursSection />

      <PublicHolidaysSection />

      {/* Dialog : programmer un changement */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Programmer un changement de tarifs</DialogTitle>
            <DialogDescription>
              La nouvelle grille s&apos;appliquera automatiquement à partir de la date
              choisie. D&apos;ici là, la grille active reste inchangée.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-date">Date d&apos;entrée en vigueur</Label>
              <Input
                id="schedule-date"
                type="date"
                min={tomorrowParisISO()}
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-auto text-base lg:text-sm"
              />
              <p className="text-xs text-zinc-500">
                La date doit être postérieure à aujourd&apos;hui.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tarifs de la nouvelle grille (€ par heure)</Label>
              <div className="overflow-x-auto scroll-x-touch rounded-lg border border-zinc-800">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-400">
                      <th className="px-3 py-2 font-medium">Studio</th>
                      <th className="px-3 py-2 font-medium">Type de groupe</th>
                      <th className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Sun className="h-3.5 w-3.5 text-zinc-500" />
                          Heures creuses
                        </div>
                      </th>
                      <th className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Moon className="h-3.5 w-3.5 text-primary" />
                          Heures pleines
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studioEntries.flatMap(([studioId, studio]) =>
                      GROUP_ORDER.map((groupType, groupIndex) => (
                        <tr
                          key={`${studioId}-${groupType}`}
                          className="border-b border-zinc-800/50 last:border-0"
                        >
                          {groupIndex === 0 && (
                            <td
                              rowSpan={GROUP_ORDER.length}
                              className="px-3 py-2 align-top font-medium"
                            >
                              {studio.name}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <Badge variant="secondary">{groupTypeLabel(groupType)}</Badge>
                          </td>
                          {[false, true].map((isPeak) => {
                            const key = cellKey(studioId, groupType, isPeak);
                            return (
                              <td key={key} className="px-3 py-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      aria-label={`Tarif ${studio.name} ${groupType} ${isPeak ? "heures pleines" : "heures creuses"} en euros par heure`}
                                      aria-invalid={Boolean(scheduleErrors.get(key))}
                                      aria-describedby={scheduleErrors.has(key) ? `${key}-price-error` : undefined}
                                      value={scheduleDrafts.get(key) ?? formatHourlyInput(scheduleCells.get(key) ?? 0)}
                                      onChange={(e) =>
                                        handleScheduleCellChange(key, e.target.value)
                                      }
                                      onBlur={(e) => handleScheduleCellBlur(key, e.target.value)}
                                      className="w-20 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <span className="text-xs text-zinc-500">€/h</span>
                                  </div>
                                  {scheduleErrors.get(key) && (
                                    <p id={`${key}-price-error`} className="text-xs text-red-400">
                                      {scheduleErrors.get(key)}
                                    </p>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-500">
                Pré-remplie avec les tarifs actuellement en vigueur. Saisissez un montant en €/h,
                avec une virgule ou un point et deux décimales maximum.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)} disabled={scheduling}>
              Annuler
            </Button>
            <Button onClick={handleSchedule} disabled={scheduling || scheduleErrors.size > 0}>
              {scheduling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Programmation...
                </>
              ) : (
                <>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Programmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : annuler une grille programmée */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Annuler la grille programmée</DialogTitle>
            <DialogDescription>
              La grille prévue pour le{" "}
              <span className="font-semibold text-zinc-200">
                {cancelTarget ? formatEffectiveDate(cancelTarget) : ""}
              </span>{" "}
              sera supprimée. La grille active restera inchangée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Conserver
            </Button>
            <Button variant="destructive" onClick={handleCancelSchedule} disabled={cancelling}>
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Annulation...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Annuler la grille
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        round_mode: editingPromo.round_mode ?? "none",
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
        round_mode: form.round_mode,
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
      <DialogContent className="lg:max-w-md">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <Label htmlFor="promo-min">Montant minimum d&apos;achat (€ TTC)</Label>
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

          {/* Round mode */}
          <div className="space-y-2">
            <Label>Arrondi de la réduction</Label>
            <Select
              value={form.round_mode}
              onValueChange={(v) => setForm((f) => ({ ...f, round_mode: v as "down" | "up" | "none" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sans arrondi</SelectItem>
                <SelectItem value="down">Arrondir aux 50 centimes</SelectItem>
                <SelectItem value="up">Arrondir aux 50 centimes au dessus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expiration + Max usage */}
          <div className="grid grid-cols-2 gap-3">
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

  // Un code sans `source` renseignée est un code créé avant la migration
  // fidélité : il est manuel par défaut (comportement historique préservé).
  const manualCodes = useMemo(
    () => promoCodes.filter((p) => p.source !== "loyalty"),
    [promoCodes],
  );
  const loyaltyCodes = useMemo(
    () => promoCodes.filter((p) => p.source === "loyalty"),
    [promoCodes],
  );

  // Annuaire client pour la colonne "Client" de la liste fidélité — l'API
  // codes promo ne renvoie que `user_id`, on résout les noms via l'API
  // utilisateurs déjà existante, une seule fois, dès qu'il y a des codes
  // fidélité à afficher.
  const [userDirectory, setUserDirectory] = useState<Map<string, DbUser>>(new Map());
  const [usersLoading, setUsersLoading] = useState(false);
  const hasLoyaltyCodes = loyaltyCodes.length > 0;

  useEffect(() => {
    if (!hasLoyaltyCodes) return;
    let active = true;
    setUsersLoading(true);
    fetch("/api/admin/users?all=true")
      .then((res) => res.json() as Promise<{ success: boolean; data?: { data: DbUser[] } }>)
      .then((json) => {
        if (active && json.success && json.data) {
          setUserDirectory(new Map(json.data.data.map((u) => [u.id, u])));
        }
      })
      .catch((error) => console.error("Failed to fetch users directory:", error))
      .finally(() => {
        if (active) setUsersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hasLoyaltyCodes]);

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

  // Mise à jour en place après un renvoi réussi : pas de refetch, le badge
  // ambre et le niveau d'insistance du bouton retombent immédiatement.
  const handleLoyaltyCodeResent = (id: string, notifiedAt: string) => {
    setPromoCodes((prev) => prev.map((p) => (p.id === id ? { ...p, notified_at: notifiedAt } : p)));
  };

  // Mise à jour en place après un changement de date d'expiration : la
  // ligne et le badge d'état se recalculent immédiatement, sans refetch.
  const handleLoyaltyCodeExpiryUpdated = (id: string, expiresAt: string) => {
    setPromoCodes((prev) => prev.map((p) => (p.id === id ? { ...p, expires_at: expiresAt } : p)));
  };

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

  const today = getParisDateISO();

  return (
    <div className="space-y-6">
      {/*
        Deux familles de codes bien distinctes : les manuels (une poignée,
        créés/modifiés à la main) et les codes fidélité (potentiellement
        plusieurs dizaines, générés par le système et strictement en lecture
        seule). Un sous-onglet par famille garde chaque liste lisible même
        quand celle de la fidélité grandit, sans jamais mélanger une action
        de création avec une liste où il n'y en a pas.
      */}
      <Tabs defaultValue="manual" className="w-full">
        <TabsList>
          <TabsTrigger value="manual" className="gap-1.5">
            <Tag className="h-4 w-4" />
            Codes manuels
            <span className="ml-0.5 text-xs text-muted-foreground">({manualCodes.length})</span>
          </TabsTrigger>
          <TabsTrigger value="loyalty" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Codes fidélité
            <span className="ml-0.5 text-xs text-muted-foreground">({loyaltyCodes.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Codes manuels ─────────────────────────────────────────────── */}
        <TabsContent value="manual" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-zinc-400">Gérez les codes promotionnels de vos studios</p>
            <Button onClick={handleNewPromo}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau code promo
            </Button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {manualCodes.length === 0 ? (
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
              <div className="overflow-x-auto scroll-x-touch">
                <table className="w-full min-w-[900px]">
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
                    {manualCodes.map((promo) => {
                      const isExpired = isPromoCodeExpired(promo.expires_at, today);
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
                              {promo.min_total > 0 ? `${promo.min_total}€ TTC` : "—"}
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
        </TabsContent>

        {/* ─── Codes fidélité (édition limitée à l'expiration) ───────────── */}
        <TabsContent value="loyalty" className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <p className="text-sm text-zinc-400">
              Ces codes sont émis automatiquement par le programme de fidélité quand un client
              atteint son palier de réservations, puis envoyés par email. Leur montant et leur
              bénéficiaire ne se modifient pas ici : seule la date d&apos;expiration peut être
              ajustée.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {loyaltyCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
                  <Sparkles className="h-7 w-7 text-zinc-500" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">Aucun code fidélité émis</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Les codes apparaîtront ici dès qu'un client atteindra son palier de fidélité.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto scroll-x-touch">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                      <th className="px-6 py-3 font-medium">Code</th>
                      <th className="px-6 py-3 font-medium">Client</th>
                      <th className="px-6 py-3 font-medium">Remise</th>
                      <th className="px-6 py-3 font-medium">Expiration</th>
                      <th className="px-6 py-3 font-medium">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyCodes.map((promo) => {
                      const status = getLoyaltyCodeStatus(promo, today);
                      const statusBadge = loyaltyStatusBadgeProps(status);
                      const notNotified = !promo.notified_at;
                      const resendable = isLoyaltyCodeResendable(promo, today);
                      const client = promo.user_id ? userDirectory.get(promo.user_id) : undefined;

                      return (
                        <tr
                          key={promo.id}
                          className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30 ${
                            notNotified ? "bg-amber-500/[0.04]" : ""
                          }`}
                        >
                          {/* Code */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <span className="font-mono text-sm font-semibold tracking-wider">
                                {promo.code}
                              </span>
                            </div>
                          </td>

                          {/* Client */}
                          <td className="px-6 py-4">
                            {!promo.user_id ? (
                              <span className="text-sm text-zinc-500">—</span>
                            ) : client ? (
                              <a
                                href={`/admin/users/${promo.user_id}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {client.name}
                              </a>
                            ) : usersLoading ? (
                              <span className="text-sm text-zinc-600">…</span>
                            ) : (
                              <span className="text-sm text-zinc-500">Compte supprimé</span>
                            )}
                          </td>

                          {/* Remise (avec portée) */}
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium tabular-nums text-primary">
                              {formatLoyaltyDiscount(promo)}
                            </span>
                          </td>

                          {/* Expiration */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-sm tabular-nums ${
                                  status === "expired" ? "text-red-400" : "text-zinc-400"
                                }`}
                              >
                                {formatDate(promo.expires_at)}
                              </span>
                              <LoyaltyCodeExpiryEditor
                                promo={promo}
                                onUpdated={(updated) =>
                                  handleLoyaltyCodeExpiryUpdated(promo.id, updated.expires_at)
                                }
                              />
                            </div>
                          </td>

                          {/* État */}
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {notNotified && (
                                <Badge
                                  className="gap-1 bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]"
                                  title="Le code a été généré mais l'email n'a pas encore été envoyé au client."
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Email non envoyé
                                </Badge>
                              )}
                              <Badge className={`${statusBadge.className} text-[10px]`}>
                                {statusBadge.label}
                              </Badge>
                              {resendable && (
                                <LoyaltyCodeResendButton
                                  promo={promo}
                                  onResent={(updated) => handleLoyaltyCodeResent(promo.id, updated.notified_at)}
                                />
                              )}
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
        </TabsContent>
      </Tabs>

      {/* Dialog (codes manuels uniquement) */}
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
      <Tabs defaultValue="pricing" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
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
