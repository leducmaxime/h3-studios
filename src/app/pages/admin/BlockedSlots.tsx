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

  const [periodFilter, setPeriodFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [studioFilter, setStudioFilter] = useState<StudioId | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "studio" | "created_at" | "reason">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [formData, setFormData] = useState({
    studioId: "" as StudioId | "",
    date: "",
    dateTo: "",
    startTime: "",
    endTime: "",
    wholeDay: false,
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
    if (!formData.date || !formData.reason.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    const dateFrom = formData.date;
    const dateTo = formData.dateTo || formData.date;
    if (dateTo < dateFrom) {
      toast.error("La date de fin doit être après la date de début");
      return;
    }

    if (!formData.wholeDay) {
      if (!formData.startTime || !formData.endTime) {
        toast.error("Veuillez sélectionner les heures");
        return;
      }
      if (formData.startTime >= formData.endTime) {
        toast.error("L'heure de fin doit être après l'heure de début");
        return;
      }
    }

    try {
        const res = await fetch("/api/admin/blocked-slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studioId: formData.studioId || null,
            dateFrom,
            dateTo,
            wholeDay: formData.wholeDay,
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
          dateTo: "",
          startTime: "",
          endTime: "",
          wholeDay: false,
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

  const isWholeDay = (slot: BlockedSlot) => slot.start_time === ALL_TIME_SLOTS[0] && slot.end_time === "00:00";

  const formatTimeLabel = (slot: BlockedSlot) => {
    if (isWholeDay(slot)) return "Toute la journée";
    return `${slot.start_time} - ${slot.end_time}`;
  };

  const filteredSlots = (() => {
    const base =
      periodFilter === "upcoming"
        ? upcomingSlots
        : periodFilter === "past"
          ? pastSlots
          : slots;

    let list = base;

    if (studioFilter !== "all") {
      list = list.filter((s) => s.studio_id === studioFilter);
    }

    if (dateFrom) {
      list = list.filter((s) => s.date >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((s) => s.date <= dateTo);
    }

    const dir = sortOrder === "asc" ? 1 : -1;
    const compareText = (a: string, b: string) => a.localeCompare(b, "fr-FR", { sensitivity: "base" });

    return [...list].sort((a, b) => {
      if (sortBy === "studio") {
        const aStudio = a.studio_id ? STUDIOS[a.studio_id].name : "Tous les studios";
        const bStudio = b.studio_id ? STUDIOS[b.studio_id].name : "Tous les studios";
        const cmp = compareText(aStudio, bStudio);
        if (cmp !== 0) return cmp * dir;
      }

      if (sortBy === "created_at") {
        const cmp = compareText(a.created_at, b.created_at);
        if (cmp !== 0) return cmp * dir;
      }

      if (sortBy === "reason") {
        const cmp = compareText(a.reason, b.reason);
        if (cmp !== 0) return cmp * dir;
      }

      const dateCmp = compareText(a.date, b.date);
      if (dateCmp !== 0) return dateCmp * dir;
      const timeCmp = compareText(a.start_time, b.start_time);
      if (timeCmp !== 0) return timeCmp * dir;
      const todayCmp = compareText(a.created_at, b.created_at);
      if (todayCmp !== 0) return todayCmp * dir;
      return 0;
    });
  })();

  const renderSlotsTable = (list: BlockedSlot[], tone: "default" | "muted") => {
    const headerText = tone === "muted" ? "text-zinc-500" : "text-zinc-400";
    const rowText = tone === "muted" ? "text-zinc-600" : "text-zinc-200";
    const subText = tone === "muted" ? "text-zinc-600" : "text-zinc-400";
    const border = tone === "muted" ? "border-white/5" : "border-white/10";
    const bg = tone === "muted" ? "bg-white/5 opacity-60" : "bg-white/5";

    return (
      <div className={`overflow-hidden rounded-xl border ${border} ${bg}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className={`border-b ${border} bg-white/5`}>
              <tr>
                <th className={`px-4 py-3 text-left text-sm font-medium ${headerText}`}>Date</th>
                <th className={`px-4 py-3 text-left text-sm font-medium ${headerText}`}>Studio</th>
                <th className={`px-4 py-3 text-left text-sm font-medium ${headerText}`}>Horaire</th>
                <th className={`px-4 py-3 text-left text-sm font-medium ${headerText}`}>Raison</th>
                <th className={`w-10 px-4 py-3 ${headerText}`} />
              </tr>
            </thead>
            <tbody className={`divide-y ${border}`}>
              {list.map((slot) => (
                <tr key={slot.id} className={tone === "muted" ? "" : "hover:bg-white/5 transition-colors"}>
                  <td className={`px-4 py-3 text-sm ${rowText}`}>{formatDate(slot.date)}</td>
                  <td className={`px-4 py-3 text-sm ${rowText}`}>
                    <Badge variant="outline" className={tone === "muted" ? "border-white/10 text-zinc-500" : "border-white/15 text-zinc-200"}>
                      {slot.studio_id ? STUDIOS[slot.studio_id].name : "Tous les studios"}
                    </Badge>
                  </td>
                  <td className={`px-4 py-3 text-sm ${subText}`}>{formatTimeLabel(slot)}</td>
                  <td className={`px-4 py-3 text-sm ${rowText}`}>
                    <span className="line-clamp-2">{slot.reason}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        tone === "muted"
                          ? "h-8 w-8 p-0 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400"
                          : "h-8 w-8 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      }
                      onClick={() => {
                        setSelectedSlot(slot);
                        setDeleteDialogOpen(true);
                      }}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Blocages d'Agenda</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Gérez les créneaux et journées non disponibles pour les réservations
          </p>
        </div>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="w-full gap-2 bg-primary text-black hover:bg-primary/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span className="whitespace-nowrap">Bloquer</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {slots.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-end">
                  <div className="w-full md:w-56">
                    <select
                      id="period"
                      aria-label="Période"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      value={periodFilter}
                      onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
                    >
                      <option value="upcoming">Blocages à venir</option>
                      <option value="past">Blocages passés</option>
                      <option value="all">Tous les blocages</option>
                    </select>
                  </div>

                  <div className="w-full md:w-56">
                    <select
                      id="studioFilter"
                      aria-label="Studio"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      value={studioFilter}
                      onChange={(e) => setStudioFilter(e.target.value as StudioId | "all")}
                    >
                      <option value="all">Tous les studios</option>
                      <option value="la-scene">La Scène</option>
                      <option value="le-podium">Le Podium</option>
                    </select>
                  </div>

                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div>
                    <Input
                      id="dateFrom"
                      type="date"
                      aria-label="Du"
                      className="border-white/10 bg-white/5 text-white"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      id="dateTo"
                      type="date"
                      aria-label="Au"
                      className="border-white/10 bg-white/5 text-white"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="w-full md:w-56">
                    <select
                      id="sortBy"
                      aria-label="Trier par"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    >
                      <option value="date">Date / heure</option>
                      <option value="studio">Studio</option>
                      <option value="created_at">Date de création</option>
                      <option value="reason">Raison</option>
                    </select>
                  </div>
                  <div className="w-full md:w-44">
                    <select
                      id="sortOrder"
                      aria-label="Ordre"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                    >
                      <option value="asc">Croissant</option>
                      <option value="desc">Décroissant</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  {filteredSlots.length} résultat(s)
                </p>
                <Button
                  variant="ghost"
                  className="text-zinc-400 hover:text-white"
                  onClick={() => {
                    setPeriodFilter("upcoming");
                    setStudioFilter("all");
                    setDateFrom("");
                    setDateTo("");
                    setSortBy("date");
                    setSortOrder("asc");
                  }}
                >
                  Réinitialiser
                </Button>
              </div>

              {filteredSlots.length > 0 ? (
                renderSlotsTable(
                  filteredSlots,
                  periodFilter === "past" ? "muted" : "default",
                )
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 py-14">
                  <Ban className="mb-3 h-10 w-10 text-zinc-600" />
                  <p className="text-sm text-zinc-400">Aucun blocage ne correspond aux filtres.</p>
                </div>
              )}
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
              <Label htmlFor="date">Date de début *</Label>
              <Input
                id="date"
                type="date"
                min={getMinDate()}
                className="border-white/10 bg-white/5 text-white"
                value={formData.date}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setFormData((prev) => {
                    const nextDateTo = prev.dateTo && prev.dateTo >= nextDate ? prev.dateTo : nextDate;
                    return { ...prev, date: nextDate, dateTo: nextDateTo };
                  });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Date de fin (optionnel)</Label>
              <Input
                id="dateTo"
                type="date"
                min={formData.date || getMinDate()}
                className="border-white/10 bg-white/5 text-white"
                value={formData.dateTo}
                onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
              />
              <p className="text-xs text-zinc-500">
                Laisser vide pour bloquer une seule journée
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="wholeDay"
                type="checkbox"
                checked={formData.wholeDay}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData((prev) => ({
                    ...prev,
                    wholeDay: checked,
                    startTime: checked ? ALL_TIME_SLOTS[0] : prev.startTime,
                    endTime: checked ? "00:00" : prev.endTime,
                  }));
                }}
                className="h-4 w-4 rounded border-white/10 bg-white/5"
              />
              <Label htmlFor="wholeDay">Toute la journée</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Heure de début *</Label>
                <select
                  id="startTime"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  disabled={formData.wholeDay}
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
                  disabled={formData.wholeDay}
                >
                  <option value="">Sélectionnez</option>
                  {ALL_TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                  <option value="00:00">00:00</option>
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
                {formatTimeLabel(selectedSlot)}
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
