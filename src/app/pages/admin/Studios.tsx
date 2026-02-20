"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
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
import { type DbEquipment } from "@/lib/db-types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EquipmentForm {
  equipmentId: string;
  name: string;
  maxPerSession: number;
  pricingType: string;
  sessionPricing: string;
  pricePerHour: number;
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
  const [equipment, setEquipment] = useState<DbEquipment[]>([]);
  const [loading, setLoading] = useState(true);

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
      const eqRes = await fetch("/api/admin/equipment");
      if (!eqRes.ok) throw new Error("Failed to fetch equipment");

      const eqJson = await eqRes.json() as { success: boolean; data: DbEquipment[] };
      if (eqJson.success) setEquipment(eqJson.data);
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

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Équipements</h1>
        <p className="text-zinc-400">Gérez les options proposées lors de la réservation</p>
      </div>

      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={openEquipmentCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un équipement
          </Button>
        </div>

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
      </div>

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
