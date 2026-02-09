"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  Building2,
  Plus,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  Music,
} from "lucide-react";
import {
  loadAdminStore,
  addBlockedSlot,
  removeBlockedSlot,
  type AdminStore,
} from "@/lib/admin-store";
import { STUDIOS, PRICING, formatPrice, TIME_SLOTS, type StudioId } from "@/lib/booking";

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export function AdminStudios() {
  const [store, setStore] = useState<AdminStore | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
    studioId: "" as StudioId | "",
    date: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: "00:00",
    reason: "",
  });

  useEffect(() => {
    setStore(loadAdminStore());
  }, []);

  const handleAddBlock = () => {
    if (!store) return;
    
    const result = addBlockedSlot(
      store,
      blockForm.studioId === "" ? null : blockForm.studioId,
      blockForm.date,
      blockForm.startTime,
      blockForm.endTime,
      blockForm.reason
    );
    
    if (result.success) {
      setStore(loadAdminStore());
      setShowBlockModal(false);
      setBlockForm({
        studioId: "",
        date: new Date().toISOString().slice(0, 10),
        startTime: "10:00",
        endTime: "00:00",
        reason: "",
      });
    }
  };

  const handleRemoveBlock = (slotId: string) => {
    if (!store) return;
    if (!confirm("Supprimer ce blocage ?")) return;
    
    removeBlockedSlot(store, slotId);
    setStore(loadAdminStore());
  };

  if (!store) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  const studioEntries = Object.entries(STUDIOS) as [StudioId, typeof STUDIOS[StudioId]][];
  const upcomingBlocks = store.blockedSlots
    .filter(s => s.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Studios</h1>
            <p className="text-zinc-400">Configuration des studios et blocages</p>
          </div>
          <button
            onClick={() => setShowBlockModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-black transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Bloquer un créneau
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {studioEntries.map(([id, studio]) => {
            const pricing = PRICING[id];
            return (
              <div
                key={id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
              >
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
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Caractéristiques</h3>
                    <div className="flex flex-wrap gap-2">
                      {studio.features.map((feature: string, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-sm"
                        >
                          <Music className="h-3 w-3 text-primary" />
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-2">Tarifs</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-zinc-700 p-3">
                        <p className="text-xs text-zinc-500">Solo</p>
                        <p className="font-medium">{formatPrice(pricing.solo.peak)}/h</p>
                        <p className="text-xs text-zinc-500">HC: {formatPrice(pricing.solo.offPeak)}/h</p>
                      </div>
                      <div className="rounded-lg border border-zinc-700 p-3">
                        <p className="text-xs text-zinc-500">Duo</p>
                        <p className="font-medium">{formatPrice(pricing.duo.peak)}/h</p>
                        <p className="text-xs text-zinc-500">HC: {formatPrice(pricing.duo.offPeak)}/h</p>
                      </div>
                      <div className="rounded-lg border border-zinc-700 p-3">
                        <p className="text-xs text-zinc-500">Groupe</p>
                        <p className="font-medium">{formatPrice(pricing.group.peak)}/h</p>
                        <p className="text-xs text-zinc-500">HC: {formatPrice(pricing.group.offPeak)}/h</p>
                      </div>
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
                      {slot.studioId ? STUDIOS[slot.studioId].name : "Tous les studios"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Calendar className="h-4 w-4" />
                      {formatDateShort(slot.date)}
                      <Clock className="ml-2 h-4 w-4" />
                      {slot.startTime} - {slot.endTime}
                    </div>
                    {slot.reason && (
                      <p className="mt-1 text-sm text-zinc-500">{slot.reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveBlock(slot.id)}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-red-400"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-bold">Bloquer un créneau</h2>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Studio</label>
                <select
                  value={blockForm.studioId}
                  onChange={(e) => setBlockForm({ ...blockForm, studioId: e.target.value as StudioId | "" })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Début</label>
                  <select
                    value={blockForm.startTime}
                    onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
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
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                  >
                    {[...TIME_SLOTS.slice(1), "00:00"].map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-400">Raison (optionnel)</label>
                <input
                  type="text"
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="ex: Maintenance, Événement privé..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowBlockModal(false)}
                className="flex-1 rounded-lg border border-zinc-700 py-2 font-medium transition-colors hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                onClick={handleAddBlock}
                className="flex-1 rounded-lg bg-primary py-2 font-medium text-black transition-colors hover:bg-primary/90"
              >
                Bloquer
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
