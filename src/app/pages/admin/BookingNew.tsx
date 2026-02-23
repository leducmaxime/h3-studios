"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  Search,
  UserPlus,
  AlertCircle,
  Plus,
  Minus,
  Gift,
} from "lucide-react";

interface ApiEquipment {
  id: string;
  name: string;
  maxPerSession: number;
  pricingType: "hourly" | "session";
  sessionPricing: number[] | null;
  pricePerHour: number;
}
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { STUDIOS, TIME_SLOTS, generateBookingRef, formatPrice, type StudioId, type GroupType } from "@/lib/booking";
import { type DbUser, type DbEquipment } from "@/lib/db-types";

import { PromoCodeInput } from "@/components/booking/PromoCodeInput";
import { type PromoCode } from "@/lib/booking";

interface UserSearchResult {
  data: DbUser[];
  total: number;
}

interface EquipmentSelection {
  id: string;
  name: string;
  quantity: number;
  maxPerSession: number;
  pricingType: "hourly" | "session";
  sessionPricing: number[] | null;
  pricePerHour: number;
}

const GROUP_TYPES: { value: GroupType; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "duo", label: "Duo" },
  { value: "group", label: "Groupe" },
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
  const [newUserNotes, setNewUserNotes] = useState("");
  const [newUserAddressLine1, setNewUserAddressLine1] = useState("");
  const [newUserAddressLine2, setNewUserAddressLine2] = useState("");
  const [newUserPostalCode, setNewUserPostalCode] = useState("");
  const [newUserCity, setNewUserCity] = useState("");
  const [newUserCountry, setNewUserCountry] = useState("France");
  const [creatingUser, setCreatingUser] = useState(false);

  // Booking fields
  const [studioId, setStudioId] = useState<StudioId | undefined>(undefined);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [groupType, setGroupType] = useState<GroupType | undefined>(undefined);
  const [notes, setNotes] = useState("");

  // Equipment
  const [availableEquipment, setAvailableEquipment] = useState<ApiEquipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentSelection[]>([]);

  // Pricing
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [equipmentPrices, setEquipmentPrices] = useState<{name: string; price: number}[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);

  // Conflict check
  const [conflict, setConflict] = useState(false);
  const [, setConflictChecking] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  // Promo code
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoDiscount, setPromoDiscount] = useState<number>(0);



  // Fetch equipment
  useEffect(() => {
    fetch("/api/equipment")
      .then((r) => r.json() as Promise<{ success: boolean; equipment?: ApiEquipment[] }>)
      .then((json) => {
        if (json.success && json.equipment) setAvailableEquipment(json.equipment);
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
      setBasePrice(null);
      setEquipmentPrices([]);
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
              const studioPrice = (rule.price_per_half_hour * halfHours) / 100;
              let eqPrice = 0;
              const eqPrices: {name: string; price: number}[] = [];
              for (const eq of selectedEquipment) {
                if (eq.pricingType === "session" && eq.sessionPricing) {
                  const price = eq.sessionPricing[eq.quantity - 1] || 0;
                  eqPrice += price;
                  if (price > 0) {
                    eqPrices.push({ name: eq.name, price });
                  }
                }
              }
              const subtotal = studioPrice + eqPrice;
              setBasePrice(studioPrice);
              setEquipmentPrices(eqPrices);
              // Apply promo discount if any
              const finalPrice = Math.max(0, subtotal - promoDiscount);
              setEstimatedPrice(finalPrice);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setPricingLoading(false));
  }, [date, startTime, endTime, studioId, groupType, selectedEquipment, promoDiscount]);

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
          notes: newUserNotes.trim() || undefined,
          address_line1: newUserAddressLine1.trim() || undefined,
          address_line2: newUserAddressLine2.trim() || undefined,
          postal_code: newUserPostalCode.trim() || undefined,
          city: newUserCity.trim() || undefined,
          country: newUserCountry.trim() || undefined,
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
        setNewUserNotes("");
        setNewUserAddressLine1("");
        setNewUserAddressLine2("");
        setNewUserPostalCode("");
        setNewUserCity("");
        setNewUserCountry("France");
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

  const getQuantity = (id: string): number => {
    const item = selectedEquipment.find((e) => e.id === id);
    return item?.quantity ?? 0;
  };

  const updateQuantity = (eq: ApiEquipment, quantity: number) => {
    setSelectedEquipment((prev) => {
      const existing = prev.filter((e) => e.id !== eq.id);
      if (quantity > 0) {
        return [...existing, { 
          id: eq.id, 
          name: eq.name, 
          quantity, 
          maxPerSession: eq.maxPerSession,
          pricingType: eq.pricingType,
          sessionPricing: eq.sessionPricing,
          pricePerHour: eq.pricePerHour
        }];
      }
      return existing;
    });
  };

  const handleIncrement = (eq: ApiEquipment) => {
    const current = getQuantity(eq.id);
    if (current < eq.maxPerSession) {
      updateQuantity(eq, current + 1);
    }
  };

  const handleDecrement = (eq: ApiEquipment) => {
    const current = getQuantity(eq.id);
    if (current > 0) {
      updateQuantity(eq, current - 1);
    }
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
        ? JSON.stringify(selectedEquipment.map((s) => ({ id: s.id, quantity: s.quantity })))
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
          notes: notes.trim() || null,
          promo_code: appliedPromo?.code || null,
          promo_discount: promoDiscount > 0 ? promoDiscount : null,
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
                        type="button"
                        key={u.id}
                        onClick={() => { setSelectedUser(u); setUserSearch(""); setUserResults([]); }}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-700"
                      >
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-zinc-400">
                            {u.band_name ? `${u.band_name}` : (u.email || "—")}
                          </p>
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
                        <label htmlFor="newUserName" className="mb-1 block text-xs text-zinc-400">Nom *</label>
                        <input
                          id="newUserName"
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="newUserEmail" className="mb-1 block text-xs text-zinc-400">Email</label>
                        <input
                          id="newUserEmail"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="newUserPhone" className="mb-1 block text-xs text-zinc-400">Téléphone</label>
                        <input
                          id="newUserPhone"
                          type="tel"
                          value={newUserPhone}
                          onChange={(e) => setNewUserPhone(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="newUserBand" className="mb-1 block text-xs text-zinc-400">Groupe / Projet</label>
                        <input
                          id="newUserBand"
                          type="text"
                          value={newUserBand}
                          onChange={(e) => setNewUserBand(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="newUserNotes" className="mb-1 block text-xs text-zinc-400">Notes</label>
                      <textarea
                        id="newUserNotes"
                        value={newUserNotes}
                        onChange={(e) => setNewUserNotes(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                      />
                    </div>

                    <div className="border-t border-zinc-700 pt-3">
                      <p className="mb-2 text-xs font-medium text-zinc-400">Adresse</p>
                      <div className="grid gap-3">
                        <div>
                          <label htmlFor="newUserAddressLine1" className="mb-1 block text-xs text-zinc-500">Adresse ligne 1</label>
                          <input
                            id="newUserAddressLine1"
                            type="text"
                            value={newUserAddressLine1}
                            onChange={(e) => setNewUserAddressLine1(e.target.value)}
                            placeholder="Rue, numéro"
                            className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="newUserAddressLine2" className="mb-1 block text-xs text-zinc-500">Adresse ligne 2 (optionnel)</label>
                          <input
                            id="newUserAddressLine2"
                            type="text"
                            value={newUserAddressLine2}
                            onChange={(e) => setNewUserAddressLine2(e.target.value)}
                            placeholder="Appartement, bâtiment, etc."
                            className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="newUserPostalCode" className="mb-1 block text-xs text-zinc-500">Code postal</label>
                            <input
                              id="newUserPostalCode"
                              type="text"
                              value={newUserPostalCode}
                              onChange={(e) => setNewUserPostalCode(e.target.value)}
                              className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label htmlFor="newUserCity" className="mb-1 block text-xs text-zinc-500">Ville</label>
                            <input
                              id="newUserCity"
                              type="text"
                              value={newUserCity}
                              onChange={(e) => setNewUserCity(e.target.value)}
                              className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="newUserCountry" className="mb-1 block text-xs text-zinc-500">Pays</label>
                          <input
                            id="newUserCountry"
                            type="text"
                            value={newUserCountry}
                            onChange={(e) => setNewUserCountry(e.target.value)}
                            className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
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
                <label htmlFor="groupType" className="mb-1 block text-sm text-zinc-400">Type de groupe *</label>
                <select
                  id="groupType"
                  value={groupType}
                  onChange={(e) => setGroupType(e.target.value as GroupType)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {GROUP_TYPES.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="studioId" className="mb-1 block text-sm text-zinc-400">Studio *</label>
                <select
                  id="studioId"
                  value={studioId}
                  onChange={(e) => setStudioId(e.target.value as StudioId)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {Object.values(STUDIOS).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.size})</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="grid gap-4 grid-cols-3">
                  <div>
                    <label htmlFor="bookingDate" className="mb-1 block text-sm text-zinc-400">Date *</label>
                    <input
                      id="bookingDate"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="startTime" className="mb-1 block text-sm text-zinc-400">Début *</label>
                    <select
                      id="startTime"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {TIME_SLOTS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="endTime" className="mb-1 block text-sm text-zinc-400">Fin *</label>
                    <select
                      id="endTime"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {[...TIME_SLOTS.slice(1), "00:00"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {startTime && endTime && startTime >= endTime && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                L'heure de fin doit être supérieure à l'heure de début.
              </div>
            )}

            {conflict && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Conflit détecté sur ce créneau. Choisissez un autre horaire.
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div>
              <label htmlFor="bookingNotes" className="mb-1 block text-sm text-zinc-400">Notes (optionnel)</label>
              <textarea
                id="bookingNotes"
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
              <div className="flex flex-col gap-3">
                {availableEquipment.map((eq) => {
                  const quantity = getQuantity(eq.id);
                  let priceDisplay = "";
                  let subtotal = 0;
                  
                  if (eq.pricingType === "session" && eq.sessionPricing) {
                    const unitPrice = eq.sessionPricing[0];
                    subtotal = quantity > 0 ? eq.sessionPricing[quantity - 1] || 0 : 0;
                    const isDegressive = eq.id === "cymbal" || eq.id === "mic";
                    if (quantity === 0) {
                      priceDisplay = `${unitPrice}€/séance${isDegressive ? " (tarif dégressif)" : ""}`;
                    } else {
                      priceDisplay = `${subtotal}€/séance${isDegressive ? " (tarif dégressif)" : ""}`;
                    }
                  } else {
                    priceDisplay = `+${eq.pricePerHour}€/h`;
                  }

                  const isFourthMicFree = eq.id === "mic" && quantity === 4;

                  return (
                    <div
                      key={eq.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">
                          {eq.name}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {priceDisplay}
                        </span>
                        {isFourthMicFree && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <Gift className="h-3 w-3" />
                            Cadeau ! Le 4ème micro est offert
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {quantity > 0 && subtotal > 0 && (
                          <span className="text-xs text-primary">
                            {formatPrice(subtotal)}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDecrement(eq)}
                            disabled={quantity === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10"
                            aria-label={`Retirer ${eq.name}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>

                          <span className="w-6 text-center text-sm font-medium tabular-nums">
                            {quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleIncrement(eq)}
                            disabled={quantity >= eq.maxPerSession}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10"
                            aria-label={`Ajouter ${eq.name}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
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
                <span>{studioId ? STUDIOS[studioId].name : "—"}</span>
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
              {(basePrice !== null || equipmentPrices.length > 0) && (
                <div className="border-t border-zinc-800 pt-3 space-y-1">
                  {basePrice !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Studio</span>
                      <span>{formatPrice(basePrice)}</span>
                    </div>
                  )}
                  {equipmentPrices.map((eq) => (
                    <div key={eq.name} className="flex justify-between text-sm">
                      <span className="text-zinc-400">{eq.name}</span>
                      <span>{formatPrice(eq.price)}</span>
                    </div>
                  ))}
                </div>
              )}
              {estimatedPrice !== null && estimatedPrice > 0 && (
                <div className="border-t border-zinc-800 pt-3">
                  <PromoCodeInput
                    total={estimatedPrice + promoDiscount}
                    appliedPromo={appliedPromo}
                    onApply={(promo, discount) => {
                      setAppliedPromo(promo);
                      setPromoDiscount(discount);
                    }}
                    onRemove={() => {
                      setAppliedPromo(null);
                      setPromoDiscount(0);
                    }}
                  />
                </div>
              )}
              {promoDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Réduction</span>
                  <span>-{formatPrice(promoDiscount)}</span>
                </div>
              )}
              <div className="border-t border-zinc-800 pt-3">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-primary">
                    {pricingLoading ? "..." : estimatedPrice !== null ? formatPrice(estimatedPrice) : "—"}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedUser || !date || !studioId || !startTime || !endTime || !groupType || conflict || !!(startTime && endTime && startTime >= endTime)}
              className="mt-6 w-full"
              size="lg"
            >
              {submitting ? "Création..." : "Créer la réservation"}
            </Button>

            {(!selectedUser || !studioId || !date || !startTime || !endTime || !groupType || (startTime && endTime && startTime >= endTime)) && (
              <p className="mt-2 text-center text-xs text-red-400">
                Saisir les champs obligatoire correctement
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
