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
  Pencil,
  Package,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDateISO } from "@/lib/utils";
import { STUDIOS, TIME_SLOTS, type StudioId } from "@/lib/booking";
import { type DbBlockedSlot, type DbPricing, type DbEquipment } from "@/lib/db-types";

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

interface EquipmentForm {
  equipmentId: string;
  name: string;
  maxPerSession: number;
  pricingType: string;
  sessionPricing: string;
  pricePerHour: number;
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

function parseSessionPricing(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatSessionPrices(prices: number[]): string {
  if (prices.length === 0) return "\u2014";
  return prices.map((p, i) => `${i + 1}\u00D7 = ${p}\u20AC`).join(", ");
}

const GROUP_LABELS: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

const INITIAL_BLOCK_FORM: BlockForm = {
  studioId: "",
  date: formatDateISO(new Date()),
  startTime: "10:00",
  endTime: "00:00",
  reason: "",
};

const INITIAL_EQUIPMENT_FORM: EquipmentForm = {
  equipmentId: "",
  name: "",
  maxPerSession: 1,
  pricingType: "session",
  sessionPricing: "3",
  pricePerHour: 0,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminStudios() {
  const [blockedSlots, setBlockedSlots] = useState<DbBlockedSlot[]>([]);
  const [pricing, setPricing] = useState<PricingByStudio>({});
  const [equipment, setEquipment] = useState<DbEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  // Block slot dialog
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockForm>(INITIAL_BLOCK_FORM);

  // Equipment dialog
  const [eqDialogOpen, setEqDialogOpen] = useState(false);
  const [eqSubmitting, setEqSubmitting] = useState(false);
  const [eqForm, setEqForm] = useState<EquipmentForm>(INITIAL_EQUIPMENT_FORM);
  const [editingEqId, setEditingEqId] = useState<string | null>(null);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DbEquipment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [slotsRes, pricingRes, eqRes] = await Promise.all([
        fetch("/api/admin/blocked-slots"),
        fetch("/api/admin/pricing"),
        fetch("/api/admin/equipment"),
      ]);

      if (slotsRes.ok) {
        const slotsJson = await slotsRes.json() as { success: boolean; data: DbBlockedSlot[] };
        if (slotsJson.success) setBlockedSlots(slotsJson.data);
      }

      if (pricingRes.ok) {
        const pricingJson = await pricingRes.json() as { success: boolean; data: DbPricing[] };
        if (pricingJson.success) setPricing(buildPricingMap(pricingJson.data));
      }

      if (eqRes.ok) {
        const eqJson = await eqRes.json() as { success: boolean; data: DbEquipment[] };
        if (eqJson.success) setEquipment(eqJson.data);
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

  // ─── Block Slot Handlers ────────────────────────────────────────────────

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
        setBlockDialogOpen(false);
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

  // ─── Equipment Handlers ─────────────────────────────────────────────────

  const openEquipmentCreate = () => {
    setEditingEqId(null);
    setEqForm(INITIAL_EQUIPMENT_FORM);
    setEqDialogOpen(true);
  };

  const openEquipmentEdit = (eq: DbEquipment) => {
    setEditingEqId(eq.id);
    const prices = parseSessionPricing(eq.session_pricing);
    setEqForm({
      equipmentId: eq.equipment_id,
      name: eq.name,
      maxPerSession: eq.max_per_session,
      pricingType: eq.pricing_type,
      sessionPricing: prices.join(", "),
      pricePerHour: eq.price_per_hour,
    });
    setEqDialogOpen(true);
  };

  const handleEquipmentSubmit = async () => {
    if (!eqForm.name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    if (!eqForm.equipmentId.trim()) {
      toast.error("L'identifiant est obligatoire");
      return;
    }
    if (eqForm.maxPerSession < 1) {
      toast.error("La quantité max doit être \u2265 1");
      return;
    }

    const sessionPrices = eqForm.sessionPricing
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));

    if (eqForm.pricingType === "session" && sessionPrices.length === 0) {
      toast.error("Veuillez renseigner au moins un tarif par séance");
      return;
    }

    setEqSubmitting(true);
    try {
      const body = {
        equipment_id: eqForm.equipmentId.trim(),
        name: eqForm.name.trim(),
        max_per_session: eqForm.maxPerSession,
        pricing_type: eqForm.pricingType,
        session_pricing: JSON.stringify(sessionPrices),
        price_per_hour: eqForm.pricePerHour,
      };

      const isEdit = editingEqId !== null;
      const url = isEdit
        ? `/api/admin/equipment/${editingEqId}`
        : "/api/admin/equipment";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json() as { success: boolean; error?: string };

      if (json.success) {
        toast.success(isEdit ? "Équipement modifié" : "Équipement ajouté");
        setEqDialogOpen(false);
        setEqForm(INITIAL_EQUIPMENT_FORM);
        setEditingEqId(null);
        fetchData();
      } else {
        toast.error(json.error || "Erreur lors de l'opération");
      }
    } catch (error) {
      console.error("Failed to save equipment:", error);
      toast.error("Erreur réseau");
    } finally {
      setEqSubmitting(false);
    }
  };

  const confirmDeleteEquipment = (eq: DbEquipment) => {
    setDeleteTarget(eq);
    setDeleteDialogOpen(true);
  };

  const handleDeleteEquipment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/equipment/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const json = await res.json() as { success: boolean; error?: string };

      if (json.success) {
        toast.success("Équipement supprimé");
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        fetchData();
      } else {
        toast.error(json.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Failed to delete equipment:", error);
      toast.error("Erreur réseau");
    } finally {
      setDeleting(false);
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
  const today = formatDateISO(new Date());
  const upcomingBlocks = blockedSlots
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Studios & Équipements</h1>
        <p className="text-zinc-400">Configuration des studios, blocages et équipements</p>
      </div>

      <Tabs defaultValue="studios" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="studios" className="gap-2">
            <Building2 className="h-4 w-4" />
            Studios
          </TabsTrigger>
          <TabsTrigger value="equipment" className="gap-2">
            <Package className="h-4 w-4" />
            Équipements
          </TabsTrigger>
        </TabsList>

        {/* ═══ STUDIOS TAB ═══ */}
        <TabsContent value="studios" className="space-y-6 mt-6">
          {/* Action bar */}
          <div className="flex justify-end">
            <Button onClick={() => setBlockDialogOpen(true)}>
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
                              <p className="font-medium">{formatPriceLocal(prices.peak)}/½h</p>
                              <p className="text-xs text-zinc-500">HC: {formatPriceLocal(prices.offPeak)}/½h</p>
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
        </TabsContent>

        {/* ═══ EQUIPMENT TAB ═══ */}
        <TabsContent value="equipment" className="space-y-6 mt-6">
          {/* Action bar */}
          <div className="flex justify-end">
            <Button onClick={openEquipmentCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un équipement
            </Button>
          </div>

          {/* Equipment table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="border-b border-zinc-800 p-4">
              <h2 className="font-semibold">Équipements disponibles</h2>
              <p className="text-sm text-zinc-400">Équipements proposés en option lors de la réservation</p>
            </div>

            {equipment.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <Package className="mx-auto mb-3 h-10 w-10 opacity-50" />
                <p>Aucun équipement configuré</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                      <th className="px-4 py-3 font-medium">Nom</th>
                      <th className="px-4 py-3 font-medium">Identifiant</th>
                      <th className="px-4 py-3 font-medium">Tarification</th>
                      <th className="px-4 py-3 font-medium text-center">Qté max</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {equipment.map((eq) => {
                      const sessionPrices = parseSessionPricing(eq.session_pricing);
                      return (
                        <tr key={eq.id} className="hover:bg-zinc-800/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Package className="h-4 w-4" />
                              </div>
                              <span className="font-medium">{eq.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                              {eq.equipment_id}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {eq.pricing_type === "session" ? (
                              <div>
                                <Badge variant="secondary" className="mb-1">Par séance</Badge>
                                <p className="text-xs text-zinc-400">{formatSessionPrices(sessionPrices)}</p>
                              </div>
                            ) : (
                              <div>
                                <Badge variant="outline" className="mb-1">Horaire</Badge>
                                <p className="text-xs text-zinc-400">{eq.price_per_hour}\u20AC/h</p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium">
                              {eq.max_per_session}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEquipmentEdit(eq)}
                                className="text-zinc-400 hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => confirmDeleteEquipment(eq)}
                                className="text-zinc-400 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
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
      </Tabs>

      {/* ═══ BLOCK SLOT DIALOG ═══ */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
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
              onClick={() => setBlockDialogOpen(false)}
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

      {/* ═══ EQUIPMENT CREATE/EDIT DIALOG ═══ */}
      <Dialog open={eqDialogOpen} onOpenChange={setEqDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>
              {editingEqId ? "Modifier l'équipement" : "Ajouter un équipement"}
            </DialogTitle>
            <DialogDescription>
              {editingEqId
                ? "Modifiez les informations de cet équipement."
                : "Ajoutez un nouvel équipement disponible à la réservation."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Nom</label>
              <input
                type="text"
                value={eqForm.name}
                onChange={(e) => setEqForm({ ...eqForm, name: e.target.value })}
                placeholder="ex: Micro supplémentaire"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">Identifiant technique</label>
              <input
                type="text"
                value={eqForm.equipmentId}
                onChange={(e) => setEqForm({ ...eqForm, equipmentId: e.target.value })}
                placeholder="ex: mic, guitar, cymbal"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                disabled={editingEqId !== null}
              />
              {editingEqId && (
                <p className="mt-1 text-xs text-zinc-500">L'identifiant ne peut pas être modifié.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Quantité max</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={eqForm.maxPerSession}
                  onChange={(e) => setEqForm({ ...eqForm, maxPerSession: parseInt(e.target.value, 10) || 1 })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Type de tarif</label>
                <select
                  value={eqForm.pricingType}
                  onChange={(e) => setEqForm({ ...eqForm, pricingType: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                >
                  <option value="session">Par séance</option>
                  <option value="hourly">Horaire</option>
                </select>
              </div>
            </div>

            {eqForm.pricingType === "session" ? (
              <div>
                <label className="mb-1 block text-sm text-zinc-400">
                  Tarifs par séance (séparés par des virgules)
                </label>
                <input
                  type="text"
                  value={eqForm.sessionPricing}
                  onChange={(e) => setEqForm({ ...eqForm, sessionPricing: e.target.value })}
                  placeholder="ex: 3, 5, 6"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Position = quantité. Ex: "3, 5, 6" → 1× = 3€, 2× = 5€, 3× = 6€
                </p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Prix par heure (€)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={eqForm.pricePerHour}
                  onChange={(e) => setEqForm({ ...eqForm, pricePerHour: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEqDialogOpen(false)}
              disabled={eqSubmitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleEquipmentSubmit}
              disabled={eqSubmitting}
            >
              {eqSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingEqId ? "Modification..." : "Ajout..."}
                </>
              ) : (
                editingEqId ? "Modifier" : "Ajouter"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRMATION DIALOG ═══ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Supprimer l'équipement</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <span className="font-semibold text-zinc-200">{deleteTarget?.name}</span> ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEquipment}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
