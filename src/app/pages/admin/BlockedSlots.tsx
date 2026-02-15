"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Calendar,
  Clock,
  Ban,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDateISO } from "@/lib/utils";
import { STUDIOS, ALL_TIME_SLOTS, type StudioId } from "@/lib/booking";

interface BlockedSlot {
  id: string;
  studio_id: StudioId | null;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
  created_at: string;
}

interface ApiResponse {
  success: boolean;
  data?: BlockedSlot[];
  error?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getMinDate(): string {
  const today = new Date();
  return formatDateISO(today);
}

export function AdminBlockedSlots() {
  const [slots, setSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BlockedSlot | null>(null);

  const [formData, setFormData] = useState({
    studioId: "" as StudioId | "",
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
  });

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blocked-slots");
      const json = (await res.json()) as ApiResponse;
      if (json.success && json.data) {
        const sorted = json.data.sort((a, b) => {
          if (a.date === b.date) {
            return a.start_time.localeCompare(b.start_time);
          }
          return a.date.localeCompare(b.date);
        });
        setSlots(sorted);
      }
    } catch (error) {
      console.error("Failed to fetch blocked slots:", error);
      toast.error("Erreur lors du chargement des créneaux bloqués");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  const handleSubmit = async () => {
    if (!formData.date || !formData.startTime || !formData.endTime || !formData.reason.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (formData.startTime >= formData.endTime) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }

    try {
      const res = await fetch("/api/admin/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId: formData.studioId || null,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          reason: formData.reason.trim(),
        }),
      });

      const json = (await res.json()) as ApiResponse;

      if (json.success) {
        toast.success("Créneau bloqué avec succès");
        setAddDialogOpen(false);
        setFormData({
          studioId: "",
          date: "",
          startTime: "",
          endTime: "",
          reason: "",
        });
        fetchSlots();
      } else {
        toast.error(json.error || "Erreur lors du blocage du créneau");
      }
    } catch (error) {
      console.error("Failed to add blocked slot:", error);
      toast.error("Erreur lors du blocage du créneau");
    }
  };

  const handleDelete = async () => {
    if (!selectedSlot) return;

    try {
      const res = await fetch(`/api/admin/blocked-slots/${selectedSlot.id}`, {
        method: "DELETE",
      });

      const json = (await res.json()) as ApiResponse;

      if (json.success) {
        toast.success("Blocage supprimé avec succès");
        setDeleteDialogOpen(false);
        setSelectedSlot(null);
        fetchSlots();
      } else {
        toast.error(json.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Failed to delete blocked slot:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const upcomingSlots = slots.filter((slot) => slot.date >= getMinDate());
  const pastSlots = slots.filter((slot) => slot.date < getMinDate());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Blocages d'Agenda</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Gérez les créneaux et journées non disponibles pour les réservations
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="gap-2 bg-primary text-black hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Bloquer un créneau
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {upcomingSlots.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Blocages à venir</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-all hover:border-primary/50 hover:bg-white/10"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Ban className="h-5 w-5 text-red-400" />
                        <div className="text-sm font-medium text-white">
                          {slot.studio_id ? STUDIOS[slot.studio_id].name : "Tous les studios"}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-400 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Calendar className="h-4 w-4" />
                        {formatDate(slot.date)}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Clock className="h-4 w-4" />
                        {slot.start_time} - {slot.end_time}
                      </div>

                      <div className="mt-3 rounded border border-white/10 bg-white/5 p-2">
                        <div className="text-xs font-medium text-zinc-500">Raison</div>
                        <div className="text-sm text-white">{slot.reason}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastSlots.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-zinc-500">Blocages passés</h2>
              <div className="grid gap-4 opacity-60 md:grid-cols-2">
                {pastSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="group rounded-lg border border-white/5 bg-white/5 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Ban className="h-5 w-5 text-zinc-600" />
                        <div className="text-sm font-medium text-zinc-500">
                          {slot.studio_id ? STUDIOS[slot.studio_id].name : "Tous les studios"}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-zinc-600 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-400 group-hover:opacity-100"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Calendar className="h-4 w-4" />
                        {formatDate(slot.date)}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <Clock className="h-4 w-4" />
                        {slot.start_time} - {slot.end_time}
                      </div>

                      <div className="mt-3 rounded border border-white/5 bg-white/5 p-2">
                        <div className="text-xs font-medium text-zinc-700">Raison</div>
                        <div className="text-sm text-zinc-500">{slot.reason}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slots.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 py-20">
              <Ban className="mb-4 h-12 w-12 text-zinc-600" />
              <h3 className="mb-2 text-lg font-medium text-white">Aucun blocage</h3>
              <p className="mb-6 text-sm text-zinc-400">
                Commencez par bloquer un créneau ou une journée complète
              </p>
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="gap-2 bg-primary text-black hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Bloquer un créneau
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="border-white/10 bg-zinc-900 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bloquer un créneau ou une journée</DialogTitle>
            <DialogDescription>
              Les créneaux bloqués ne seront pas disponibles pour la réservation publique
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="studio">Studio (optionnel)</Label>
              <select
                id="studio"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={formData.studioId}
                onChange={(e) =>
                  setFormData({ ...formData, studioId: e.target.value as StudioId | "" })
                }
              >
                <option value="">Tous les studios</option>
                <option value="la-scene">La Scène</option>
                <option value="le-podium">Le Podium</option>
              </select>
              <p className="text-xs text-zinc-500">
                Laisser vide pour bloquer le créneau sur tous les studios
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                min={getMinDate()}
                className="border-white/10 bg-white/5 text-white"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Heure de début *</Label>
                <select
                  id="startTime"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                >
                  <option value="">Sélectionnez</option>
                  {ALL_TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">Heure de fin *</Label>
                <select
                  id="endTime"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                >
                  <option value="">Sélectionnez</option>
                  {ALL_TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Raison *</Label>
              <Input
                id="reason"
                placeholder="Ex: Vacances d'été, Maintenance, Événement privé..."
                className="border-white/10 bg-white/5 text-white"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAddDialogOpen(false)}
              className="text-zinc-400 hover:text-white"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-primary text-black hover:bg-primary/90"
            >
              Bloquer le créneau
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-white/10 bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce blocage ? Le créneau redeviendra disponible
              pour les réservations.
            </DialogDescription>
          </DialogHeader>

          {selectedSlot && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="mb-2 text-sm font-medium text-white">
                {selectedSlot.studio_id ? STUDIOS[selectedSlot.studio_id].name : "Tous les studios"}
              </div>
              <div className="text-sm text-zinc-400">{formatDate(selectedSlot.date)}</div>
              <div className="text-sm text-zinc-400">
                {selectedSlot.start_time} - {selectedSlot.end_time}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedSlot(null);
              }}
              className="text-zinc-400 hover:text-white"
            >
              Annuler
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
