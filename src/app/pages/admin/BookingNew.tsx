"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  Search,
  UserPlus,
  AlertCircle,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateISO } from "@/lib/utils";
import { STUDIOS, TIME_SLOTS, generateBookingRef, formatPrice, type StudioId, type GroupType } from "@/lib/booking";
import { type DbUser, type DbEquipment } from "@/lib/db-types";

interface UserSearchResult {
  data: DbUser[];
  total: number;
}

interface EquipmentSelection {
  equipment_id: string;
  name: string;
  quantity: number;
  maxPerSession: number;
}

const GROUP_TYPES: { value: GroupType; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "duo", label: "Duo" },
  { value: "group", label: "Groupe" },
];

const PAYMENT_METHODS = [
  { value: "card", label: "Carte bancaire" },
  { value: "cash", label: "Espèces" },
];

export function AdminBookingNew() {
  // User selection
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<DbUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<DbUser | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserBand, setNewUserBand] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Booking fields
  const [studioId, setStudioId] = useState<StudioId>("la-scene");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("16:00");
  const [groupType, setGroupType] = useState<GroupType>("group");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  // Equipment
  const [availableEquipment, setAvailableEquipment] = useState<DbEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentSelection[]>([]);

  // Pricing
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Conflict check
  const [conflict, setConflict] = useState(false);
  const [, setConflictChecking] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(formatDateISO(tomorrow));
  }, []);

  // Fetch equipment
  useEffect(() => {
    fetch("/api/admin/equipment")
      .then((r) => r.json() as Promise<{ success: boolean; data?: DbEquipment[] }>)
      .then((json) => {
        if (json.success && json.data) setAvailableEquipment(json.data);
      })
      .catch(() => {});
  }, []);

  // Search users (debounced)
  useEffect(() => {
    if (userSearch.length < 2) {
      setUserResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}&limit=5`);
        const json = (await res.json()) as { success: boolean; data?: UserSearchResult };
        if (json.success && json.data) {
          setUserResults(json.data.data);
        }
      } catch {
        // silent
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  // Check conflict when studio/date/time changes
  const checkConflict = useCallback(async () => {
    if (!date || !startTime || !endTime || !studioId) return;
    setConflictChecking(true);
    try {
      const params = new URLSearchParams({
        studio: studioId,
        dateFrom: date,
        dateTo: date,
        status: "confirmed",
      });
      const res = await fetch(`/api/admin/bookings?${params}`);
      const json = (await res.json()) as { success: boolean; data?: { data: Array<{ start_time: string; end_time: string }> } };
      if (json.success && json.data) {
        const hasConflict = json.data.data.some((b) => {
          return b.start_time < endTime && b.end_time > startTime;
        });
        setConflict(hasConflict);
      }
    } catch {
      // silent
    } finally {
      setConflictChecking(false);
    }
  }, [date, startTime, endTime, studioId]);

  useEffect(() => {
    checkConflict();
  }, [checkConflict]);

  // Calculate price when relevant fields change
  useEffect(() => {
    if (!date || !startTime || !endTime || !studioId || !groupType) {
      setEstimatedPrice(null);
      return;
    }

    const isPeak = startTime >= "18:00" || (() => {
      const d = new Date(date + "T00:00:00");
      const day = d.getDay();
      return day === 0 || day === 6;
    })();

    setPricingLoading(true);
    fetch("/api/admin/pricing")
      .then((r) => r.json() as Promise<{ success: boolean; data?: Array<{ studio_id: string; group_type: string; is_peak: number; price_per_half_hour: number }> }>)
      .then((json) => {
        if (json.success && json.data) {
          const rule = json.data.find(
            (p) => p.studio_id === studioId && p.group_type === groupType && p.is_peak === (isPeak ? 1 : 0)
          );
          if (rule) {
            const startParts = startTime.split(":").map(Number);
            const endParts = endTime.split(":").map(Number);
            const halfHours = ((endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1])) / 30;
            if (halfHours > 0) {
              let eqPrice = 0;
              for (const eq of selectedEquipment) {
                const dbEq = availableEquipment.find((e) => e.equipment_id === eq.equipment_id);
                if (dbEq?.session_pricing) {
                  try {
                    const prices = JSON.parse(dbEq.session_pricing) as number[];
                    eqPrice += prices[eq.quantity - 1] || 0;
                  } catch {
                    // skip
                  }
                }
              }
              setEstimatedPrice(rule.price_per_half_hour * halfHours + eqPrice);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setPricingLoading(false));
  }, [date, startTime, endTime, studioId, groupType, selectedEquipment, availableEquipment]);

  const handleCreateUser = async () => {
    if (!newUserName.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim() || undefined,
          phone: newUserPhone.trim() || undefined,
          band_name: newUserBand.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: DbUser; error?: string };
      if (json.success && json.data) {
        setSelectedUser(json.data);
        setShowNewUser(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPhone("");
        setNewUserBand("");
        toast.success("Client créé");
      } else {
        toast.error(json.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setCreatingUser(false);
    }
  };

  const toggleEquipment = (eq: DbEquipment) => {
    setSelectedEquipment((prev) => {
      const existing = prev.find((s) => s.equipment_id === eq.equipment_id);
      if (existing) {
        return prev.filter((s) => s.equipment_id !== eq.equipment_id);
      }
      return [...prev, { equipment_id: eq.equipment_id, name: eq.name, quantity: 1, maxPerSession: eq.max_per_session }];
    });
  };

  const updateEquipmentQuantity = (equipmentId: string, qty: number) => {
    setSelectedEquipment((prev) =>
      prev.map((s) => s.equipment_id === equipmentId ? { ...s, quantity: qty } : s)
    );
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      toast.error("Sélectionnez un client");
      return;
    }
    if (!date || !startTime || !endTime) {
      toast.error("Date et créneau requis");
      return;
    }
    if (conflict) {
      toast.error("Conflit détecté — choisissez un autre créneau");
      return;
    }

    setSubmitting(true);
    try {
      const equipmentJson = selectedEquipment.length > 0
        ? JSON.stringify(selectedEquipment.map((s) => ({ id: s.equipment_id, quantity: s.quantity })))
        : null;

      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_ref: generateBookingRef(),
          user_id: selectedUser.id,
          studio_id: studioId,
          date,
          start_time: startTime,
          end_time: endTime,
          group_type: groupType,
          equipment: equipmentJson,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: { id: string }; error?: string };
      if (json.success && json.data) {
        toast.success("Réservation créée");
        window.location.href = `/admin/bookings/${json.data.id}`;
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <a href="/admin/bookings" className="rounded-lg p-2 hover:bg-zinc-800">
          <ChevronLeft className="h-5 w-5" />
        </a>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle réservation</h1>
          <p className="text-zinc-400">Créer une réservation manuellement</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Client */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">Client</h2>

            {selectedUser ? (
              <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 p-4">
                <div>
                  <p className="font-medium">{selectedUser.name}</p>
                  <p className="text-sm text-zinc-400">{selectedUser.email || "—"} · {selectedUser.phone || "—"}</p>
                  {selectedUser.band_name && <p className="text-sm text-zinc-400">{selectedUser.band_name}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                  Changer
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un client existant..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                {userResults.length > 0 && (
                  <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-700 bg-zinc-800">
                    {userResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedUser(u); setUserSearch(""); setUserResults([]); }}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-700"
                      >
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-zinc-400">{u.email || "—"}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{u.total_bookings} résa</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {!showNewUser ? (
                  <Button variant="outline" size="sm" onClick={() => setShowNewUser(true)} className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Nouveau client
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-800 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-400">Nom *</label>
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-400">Email</label>
                        <input
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-400">Téléphone</label>
                        <input
                          type="tel"
                          value={newUserPhone}
                          onChange={(e) => setNewUserPhone(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-400">Groupe / Projet</label>
                        <input
                          type="text"
                          value={newUserBand}
                          onChange={(e) => setNewUserBand(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateUser} disabled={creatingUser}>
                        {creatingUser ? "Création..." : "Créer le client"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowNewUser(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Studio + Date + Time */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">Créneau</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Studio</label>
                <select
                  value={studioId}
                  onChange={(e) => setStudioId(e.target.value as StudioId)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {Object.values(STUDIOS).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.size})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Début</label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Fin</label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {[...TIME_SLOTS.slice(1), "00:00"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {conflict && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Conflit détecté sur ce créneau. Choisissez un autre horaire.
              </div>
            )}
          </div>

          {/* Type + Payment */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">Options</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Type de groupe</label>
                <select
                  value={groupType}
                  onChange={(e) => setGroupType(e.target.value as GroupType)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {GROUP_TYPES.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Méthode de paiement</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm text-zinc-400">Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Equipment */}
          {availableEquipment.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 font-semibold">Équipements optionnels</h2>
              <div className="space-y-2">
                {availableEquipment.map((eq) => {
                  const selected = selectedEquipment.find((s) => s.equipment_id === eq.equipment_id);
                  return (
                    <div key={eq.id} className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleEquipment(eq)}
                          className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-black" : "border-zinc-600"}`}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </button>
                        <span className="text-sm">{eq.name}</span>
                      </div>
                      {selected && eq.max_per_session > 1 && (
                        <select
                          value={selected.quantity}
                          onChange={(e) => updateEquipmentQuantity(eq.equipment_id, parseInt(e.target.value, 10))}
                          className="rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-xs"
                        >
                          {Array.from({ length: eq.max_per_session }, (_, i) => (
                            <option key={i + 1} value={i + 1}>×{i + 1}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Price summary */}
        <div>
          <div className="sticky top-24 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">Récapitulatif</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Studio</span>
                <span>{STUDIOS[studioId].name}</span>
              </div>
              {date && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Date</span>
                  <span>{new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Créneau</span>
                <span>{startTime} - {endTime}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Type</span>
                <span className="capitalize">{groupType}</span>
              </div>
              {selectedUser && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Client</span>
                  <span className="truncate ml-2">{selectedUser.name}</span>
                </div>
              )}
              {selectedEquipment.length > 0 && (
                <div className="border-t border-zinc-800 pt-3">
                  <p className="mb-1 text-xs text-zinc-400">Équipements</p>
                  {selectedEquipment.map((eq) => (
                    <div key={eq.equipment_id} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{eq.name}</span>
                      <span>×{eq.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-zinc-800 pt-3">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total estimé</span>
                  <span className="text-primary">
                    {pricingLoading ? "..." : estimatedPrice !== null ? formatPrice(estimatedPrice) : "—"}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedUser || !date || conflict}
              className="mt-6 w-full"
              size="lg"
            >
              {submitting ? "Création..." : "Créer la réservation"}
            </Button>

            {conflict && (
              <p className="mt-2 text-center text-xs text-red-400">
                Impossible : conflit de créneau
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
