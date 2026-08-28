"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  Mail,
  Phone,
  Music,
  Calendar,
  Ban,
  Edit,
  Save,
  Search,
  Download,
  Plus,
  ChevronUp,
  ChevronDown,
  Building2,
  FileText,
  Instagram,
  Wallet,
  Clock,
  AlertTriangle,
  StickyNote,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateISO, getParisDateISO } from "@/lib/utils";
import { formatSiret, resolveUserClientIdentity } from "@/lib/client-identity";
import { bookingFieldLabel, getVisibleBookingFields, isClientType, type ClientType } from "@/lib/booking-fields";
import { formatPrice, type StudioId } from "@/lib/booking";
import { getBookingAmountDue, getDisplayPaymentStatusFromSummary, isKeepBalanceDue } from "@/lib/booking-totals";
import { bookingStatusLabel, displayPaymentStatusLabel, groupTypeLabel, paymentMethodLabelShort, paymentRecordStatusLabel, paymentTypeLabel, studioLabel } from "@/lib/labels";
import { type DbUser, type DbPromoCode, type BookingWithUser, type BookingStatus, type BookingSortField, type BookingSortOrder, type UserOpsSnapshot, type UserBookingInsights } from "@/lib/db-types";
import { exportBookingsCSV } from "@/lib/export";
import { formatDurationHours } from "@/lib/user-booking-stats";
import { formatCountRate, formatNextBookingWhen } from "@/lib/user-ops-snapshot";
import {
  getLoyaltyCodeStatus,
  loyaltyStatusBadgeProps,
  formatLoyaltyDiscount,
  isLoyaltyCodeResendable,
} from "@/lib/loyalty-code-display";
import { LoyaltyCodeResendButton } from "@/components/admin/LoyaltyCodeResendButton";
import { LoyaltyCodeExpiryEditor } from "@/components/admin/LoyaltyCodeExpiryEditor";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// Vocabulaire des codes fidélité (statut, portée, éligibilité au renvoi) :
// voir src/lib/loyalty-code-display.ts, partagé avec Pricing.tsx.

interface ClientPaymentRow {
  id: string;
  booking_id: string;
  amount: number;
  method: string;
  payment_type: "on-site" | "online";
  status: "pending" | "paid" | "refunded" | "partial-refund";
  refunded_amount: number;
  created_at: string;
  booking_ref: string | null;
  booking_date: string | null;
}

// ─── Remise de fidélité (issue #48) ───────────────────────────────────────
// `loyalty` est calculé par GET /api/admin/users/:id et n'appartient pas à
// la ligne users : il reste donc typé ici, à côté de DbUser.
type LoyaltyDiscountType = "percentage" | "fixed";

interface LoyaltyProgress {
  pastEligibleBookings: number;
  awardsGranted: number;
  counter: number;
  remainingToNextAward: number;
  isDue: boolean;
  threshold: number;
  totalDiscountGranted?: number;
  validityDays?: number;
  codes?: DbPromoCode[];
}

type UserWithLoyalty = DbUser & {
  loyalty?: LoyaltyProgress | null;
  ops?: UserOpsSnapshot | null;
  insights?: UserBookingInsights | null;
};

interface LoyaltyFormState {
  enabled: boolean;
  discountType: LoyaltyDiscountType;
  value: string;
  threshold: string;
  validityDays: string;
}

const DEFAULT_LOYALTY_CODE_VALIDITY_DAYS = 60;

function loyaltyFormFromUser(u: UserWithLoyalty): LoyaltyFormState {
  return {
    enabled: u.loyalty_enabled === 1,
    discountType: u.loyalty_discount_type === "fixed" ? "fixed" : "percentage",
    value: u.loyalty_discount_value ? String(u.loyalty_discount_value) : "",
    threshold: u.loyalty_threshold ? String(u.loyalty_threshold) : "",
    validityDays: String(u.loyalty_code_validity_days ?? DEFAULT_LOYALTY_CODE_VALIDITY_DAYS),
  };
}

interface UserDetailProps {
  userId: string;
}

export function AdminUserDetail({ userId }: UserDetailProps) {
  const [user, setUser] = useState<UserWithLoyalty | null>(null);
  // La remise est un levier tarifaire : réservée au super-admin, comme la
  // grille de tarifs. Le serveur refuse de toute façon (403) pour un opérateur.
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
  const [payments, setPayments] = useState<ClientPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    band_name: "",
    notes: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
    city: "",
    country: "",
    client_type: "particulier" as ClientType,
    legal_name: "",
    siret: "",
    rna: "",
    instagram_accounts: "",
  });

  // Remise de fidélité
  const [loyaltyEditing, setLoyaltyEditing] = useState(false);
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [loyaltyForm, setLoyaltyForm] = useState<LoyaltyFormState>({
    enabled: false,
    discountType: "percentage",
    value: "",
    threshold: "",
    validityDays: String(DEFAULT_LOYALTY_CODE_VALIDITY_DAYS),
  });

  const [notesEditing, setNotesEditing] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // Filters (like /admin/bookings)
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [studioFilter, setStudioFilter] = useState<StudioId | "all">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "upcoming" | "past" | "custom">("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "paid" | "remaining">("all");
  const [sortBy, setSortBy] = useState<BookingSortField>("date");
  const [sortOrder, setSortOrder] = useState<BookingSortOrder>("desc");

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const json = (await res.json()) as { success: boolean; data?: UserWithLoyalty; error?: string };
      if (json.success && json.data) {
        setUser(json.data);
        setLoyaltyForm(loyaltyFormFromUser(json.data));
        if (!notesEditing) setNotesDraft(json.data.notes || "");
        setEditForm({
          name: json.data.name,
          email: json.data.email || "",
          phone: json.data.phone || "",
          band_name: json.data.band_name || "",
          notes: json.data.notes || "",
          address_line1: json.data.address_line1 || "",
          address_line2: json.data.address_line2 || "",
          postal_code: json.data.postal_code || "",
          city: json.data.city || "",
          country: json.data.country || "",
          client_type: isClientType(json.data.client_type) ? json.data.client_type : "particulier",
          legal_name: json.data.legal_name || "",
          siret: json.data.siret || "",
          rna: json.data.rna || "",
          instagram_accounts: json.data.instagram_accounts || "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      toast.error("Erreur lors du chargement du profil");
    }
  }, [userId]);

  const fetchBookings = useCallback(async () => {
    try {
      const params = new URLSearchParams({ userId: userId, all: "true" });
      const res = await fetch(`/api/admin/bookings?${params}`);
      const json = (await res.json()) as {
        success: boolean;
        data?: { data: BookingWithUser[]; total: number };
      };
      if (json.success && json.data) {
        setBookings(json.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    }
  }, [userId]);

  const fetchPayments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ userId, all: "true", sortBy: "created_at", sortOrder: "desc" });
      const res = await fetch(`/api/admin/payments?${params}`);
      const json = (await res.json()) as {
        success: boolean;
        data?: { data: ClientPaymentRow[] };
      };
      if (json.success && json.data) {
        setPayments(json.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    }
  }, [userId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchUser(), fetchBookings(), fetchPayments()]);
      setLoading(false);
    };
    load();
  }, [fetchUser, fetchBookings, fetchPayments]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/me")
      .then((r) => r.json() as Promise<{ success: boolean; data?: { role?: string } }>)
      .then((json) => { if (active && json.success) setIsSuperAdmin(json.data?.role === "super-admin"); })
      .catch(() => { /* rôle inconnu : le panneau reste masqué */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleBlock = async () => {
    if (!user) return;
    const newBlocked = user.is_blocked !== 1;

    try {
      const res = await fetch(`/api/admin/users/${user.id}/block`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: newBlocked }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(newBlocked ? "Client bloqué" : "Client débloqué");
        setUser({ ...user, is_blocked: newBlocked ? 1 : 0 });
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch (error) {
      console.error("Block error:", error);
      toast.error("Erreur lors du blocage");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const visibleFields = getVisibleBookingFields(editForm.client_type);
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          band_name: editForm.band_name.trim() || null,
          notes: editForm.notes.trim() || null,
          address_line1: editForm.address_line1.trim() || null,
          address_line2: editForm.address_line2.trim() || null,
          postal_code: editForm.postal_code.trim() || null,
          city: editForm.city.trim() || null,
          country: editForm.country.trim() || null,
          client_type: editForm.client_type,
          legal_name: visibleFields.includes("legalName") ? editForm.legal_name.trim() || null : null,
          siret: visibleFields.includes("siret") ? editForm.siret.trim() || null : null,
          rna: visibleFields.includes("rna") ? editForm.rna.trim() || null : null,
          instagram_accounts: visibleFields.includes("instagramAccounts") ? editForm.instagram_accounts.trim() || null : null,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: DbUser; error?: string };
      if (json.success && json.data) {
        toast.success("Profil mis à jour");
        setUser({ ...user, ...json.data, loyalty: user.loyalty, ops: user.ops, insights: user.insights });
        setEditing(false);
      } else {
        toast.error(json.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const parseLoyaltyNumber = (raw: string): number => Number(raw.trim().replace(",", "."));

  const validateLoyaltyForm = (): string | null => {
    if (!loyaltyForm.enabled) return null;
    const value = parseLoyaltyNumber(loyaltyForm.value);
    const threshold = parseLoyaltyNumber(loyaltyForm.threshold);
    const validityDays = parseLoyaltyNumber(loyaltyForm.validityDays);
    if (!loyaltyForm.value.trim() || !Number.isFinite(value) || value <= 0) {
      return "La valeur de la remise doit être un nombre strictement positif.";
    }
    if (loyaltyForm.discountType === "percentage" && value > 100) {
      return "Le pourcentage doit être compris entre 0 et 100.";
    }
    if (!Number.isInteger(threshold) || threshold < 1) {
      return "Le seuil doit être un nombre entier d'au moins 1.";
    }
    if (!Number.isInteger(validityDays) || validityDays < 1) {
      return "La durée de validité du code doit être un nombre entier d'au moins 1 jour.";
    }
    return null;
  };

  const handleSaveLoyalty = async () => {
    if (!user) return;
    const validationError = validateLoyaltyForm();
    if (validationError) {
      setLoyaltyError(validationError);
      return;
    }
    setLoyaltyError(null);
    setLoyaltySaving(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loyalty_enabled: loyaltyForm.enabled ? 1 : 0,
          loyalty_discount_type: loyaltyForm.enabled ? loyaltyForm.discountType : (user.loyalty_discount_type ?? null),
          loyalty_discount_value: loyaltyForm.enabled ? parseLoyaltyNumber(loyaltyForm.value) : (user.loyalty_discount_value ?? 0),
          loyalty_threshold: loyaltyForm.enabled ? parseLoyaltyNumber(loyaltyForm.threshold) : (user.loyalty_threshold ?? 0),
          loyalty_code_validity_days: loyaltyForm.enabled
            ? parseLoyaltyNumber(loyaltyForm.validityDays)
            : (user.loyalty_code_validity_days ?? DEFAULT_LOYALTY_CODE_VALIDITY_DAYS),
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: UserWithLoyalty; error?: string };
      if (json.success) {
        toast.success(loyaltyForm.enabled ? "Remise de fidélité enregistrée" : "Remise de fidélité désactivée");
        setLoyaltyEditing(false);
        // Refetch to get the refreshed loyalty progress object
        await fetchUser();
      } else {
        setLoyaltyError(json.error || "Erreur lors de la sauvegarde");
        toast.error(json.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Loyalty save error:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoyaltySaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!user) return;
    setNotesSaving(true);
    try {
      const notes = notesDraft.trim() || null;
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = (await res.json()) as { success: boolean; data?: DbUser; error?: string };
      if (json.success && json.data) {
        toast.success(notes ? "Note enregistrée" : "Note supprimée");
        setUser({ ...user, ...json.data, loyalty: user.loyalty, ops: user.ops, insights: user.insights });
        setEditForm((current) => ({ ...current, notes: notes ?? "" }));
        setNotesDraft(notes ?? "");
        setNotesEditing(false);
      } else {
        toast.error(json.error || "Erreur lors de la sauvegarde");
      }
    } catch (error) {
      console.error("Notes save error:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setNotesSaving(false);
    }
  };

  const handleCancelNotes = () => {
    setNotesDraft(user?.notes || "");
    setNotesEditing(false);
  };

  const handleCancelLoyalty = () => {
    if (user) setLoyaltyForm(loyaltyFormFromUser(user));
    setLoyaltyError(null);
    setLoyaltyEditing(false);
  };

  // Mise à jour en place après un renvoi réussi : pas de refetch, le badge
  // ambre et le niveau d'insistance du bouton retombent immédiatement.
  const handleLoyaltyCodeResent = (codeId: string, notifiedAt: string) => {
    setUser((prev) => {
      if (!prev || !prev.loyalty) return prev;
      return {
        ...prev,
        loyalty: {
          ...prev.loyalty,
          codes: (prev.loyalty.codes ?? []).map((c) =>
            c.id === codeId ? { ...c, notified_at: notifiedAt } : c,
          ),
        },
      };
    });
  };

  // Mise à jour en place après un changement de date d'expiration : la
  // ligne et le badge d'état se recalculent immédiatement, sans refetch.
  const handleLoyaltyCodeExpiryUpdated = (codeId: string, expiresAt: string) => {
    setUser((prev) => {
      if (!prev || !prev.loyalty) return prev;
      return {
        ...prev,
        loyalty: {
          ...prev.loyalty,
          codes: (prev.loyalty.codes ?? []).map((c) =>
            c.id === codeId ? { ...c, expires_at: expiresAt } : c,
          ),
        },
      };
    });
  };

  if (loading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const today = formatDateISO(new Date());

  // Client-side filtering (all bookings already loaded)
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (studioFilter !== "all" && b.studio_id !== studioFilter) return false;
    if (paymentStatusFilter !== "all") {
      if (paymentStatusFilter === "paid" && b.payment_status !== "paid") return false;
      if (paymentStatusFilter === "remaining" && b.payment_status === "paid") return false;
    }
    if (dateFilter !== "all") {
      if (dateFilter === "today" && b.date !== today) return false;
      if (dateFilter === "week") {
        const d = new Date(b.date);
        const weekStart = new Date();
        weekStart.setDate(new Date().getDate() - new Date().getDay() + 1);
        if (d < weekStart) return false;
      }
      if (dateFilter === "month") {
        const d = new Date(b.date);
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (d < monthStart) return false;
      }
      if (dateFilter === "upcoming" && b.date < today) return false;
      if (dateFilter === "past" && b.date > today) return false;
      if (dateFilter === "custom" && customDateFrom) {
        if (b.date < customDateFrom) return false;
        if (customDateTo && b.date > customDateTo) return false;
      }
    }
    if (search) {
      const q = search.toLowerCase();
      const match =
        (b.booking_ref?.toLowerCase() || "").includes(q) ||
        (b.band_name?.toLowerCase() || "").includes(q) ||
        (b.studio_id?.toLowerCase() || "").includes(q) ||
        b.date.includes(q) ||
        (b.group_type?.toLowerCase() || "").includes(q);
      if (!match) return false;
    }
    return true;
  });

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const dir = sortOrder === "asc" ? 1 : -1;
    switch (sortBy) {
      case "date":
        return (a.date > b.date ? 1 : -1) * dir;
      case "start_time":
        return (a.start_time > b.start_time ? 1 : -1) * dir;
      case "total_price": {
        const pa = getBookingAmountDue(a);
        const pb = getBookingAmountDue(b);
        return (pa > pb ? 1 : -1) * dir;
      }
      case "status":
        return (a.status > b.status ? 1 : -1) * dir;
      case "payment_status":
        return ((a.payment_status || "") > (b.payment_status || "") ? 1 : -1) * dir;
      case "created_at":
        return ((a.created_at || "") > (b.created_at || "") ? 1 : -1) * dir;
      default:
        return (a.date > b.date ? 1 : -1) * dir;
    }
  });

  const handleExportCSV = () => {
    exportBookingsCSV(sortedBookings);
  };

  const bookingInsights = user.insights;
  const firstBookingDate = bookingInsights?.firstBookingDate ?? null;
  const lastBookingDate = bookingInsights?.lastBookingDate ?? null;
  const totalHours = (user.total_minutes ?? 0) / 60;
  const monthsSinceFirst = firstBookingDate
    ? Math.max(1, Math.round((Date.now() - new Date(`${firstBookingDate}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
    : 0;
  const freqMensuelle = user.total_bookings > 0
    ? (monthsSinceFirst > 1 ? (user.total_bookings / monthsSinceFirst).toFixed(1) : String(user.total_bookings))
    : null;

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ")
    || user.name?.trim()
    || user.email
    || "—";

  // Remise de fidélité — derived display values
  const loyaltyEnabled = user.loyalty_enabled === 1;
  const loyaltyDiscountLabel = user.loyalty_discount_type === "fixed"
    ? formatPrice(user.loyalty_discount_value ?? 0)
    : `${(user.loyalty_discount_value ?? 0).toLocaleString("fr-FR")} %`;
  const loyaltyThreshold = user.loyalty_threshold ?? 0;
  const loyaltyProgress = user.loyalty ?? null;
  const loyaltyProgressPct = loyaltyProgress
    && Number.isFinite(loyaltyProgress.threshold)
    && loyaltyProgress.threshold > 0
    && Number.isFinite(loyaltyProgress.counter)
    ? loyaltyProgress.isDue
      ? 100
      : Math.min(100, Math.round((loyaltyProgress.counter / loyaltyProgress.threshold) * 100))
    : 0;
  const loyaltyCodeValidityDays = user.loyalty_code_validity_days
    ?? loyaltyProgress?.validityDays
    ?? DEFAULT_LOYALTY_CODE_VALIDITY_DAYS;
  const loyaltyCodes = loyaltyProgress?.codes ?? [];
  const todayISO = getParisDateISO();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <a href="/admin/users" className="rounded-lg p-2 hover:bg-zinc-800">
          <ChevronLeft className="h-5 w-5" />
        </a>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {user.is_blocked === 1 && (
              <Badge variant="destructive">Bloqué</Badge>
            )}
          </div>
          <p className="text-zinc-400">Profil client</p>
        </div>
        <a href={`/admin/bookings/new?userId=${user.id}`}>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle réservation</span>
            <span className="sm:hidden">Réserver</span>
          </Button>
        </a>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="bookings">
            Réservations ({bookings.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Paiements ({payments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <a
                href={`/admin/recouvrement?userId=${user.id}`}
                className={`rounded-xl border p-4 transition-colors hover:bg-zinc-800/60 ${user.ops && user.ops.overdueCount > 0 ? "border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10" : "border-zinc-800 bg-zinc-900"}`}
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {user.ops && user.ops.overdueCount > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-orange-400" /> : <Wallet className="h-3.5 w-3.5" />}
                  Recouvrement
                </div>
                {user.ops && user.ops.overdueCount > 0 ? (
                  <>
                    <p className="text-lg font-semibold text-orange-300">{formatPrice(user.ops.overdueRemaining)}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {user.ops.overdueCount} séance{user.ops.overdueCount > 1 ? "s" : ""} en retard
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-semibold">Aucun impayé</p>
                )}
              </a>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <Clock className="h-3.5 w-3.5" />
                  Prochaine réservation
                </div>
                {user.ops?.nextBooking ? (
                  <>
                    <p className="text-lg font-semibold">{formatNextBookingWhen(user.ops.nextBooking.date)}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {studioLabel(user.ops.nextBooking.studio_id)} · {user.ops.nextBooking.start_time.slice(0, 5)}–{user.ops.nextBooking.end_time.slice(0, 5)}
                    </p>
                    <a
                      href={`/admin/bookings/${user.ops.nextBooking.id}`}
                      className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      {user.ops.nextBooking.booking_ref}
                    </a>
                  </>
                ) : (
                  <p className="text-lg font-semibold text-zinc-300">Aucune à venir</p>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Total dépensé
                </div>
                <p className="text-lg font-semibold text-primary">{formatPrice(user.total_spent)}</p>
                <p className="mt-2 text-xs text-zinc-400">
                  {user.total_bookings} réservation{user.total_bookings > 1 ? "s" : ""}
                  {user.total_bookings > 0 ? ` · panier moyen ${formatPrice(user.total_spent / user.total_bookings)}` : ""}
                </p>
              </div>
            </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">Informations</h2>
                  {editing ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                        <Save className="h-4 w-4" />
                        {saving ? "Sauvegarde..." : "Enregistrer"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(false)}
                        disabled={saving}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNotesEditing(false);
                        setEditing(true);
                      }}
                      className="gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Modifier
                    </Button>
                  )}
                </div>

                {editing ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2 lg:col-span-2">
                      <Label htmlFor="edit-client-type">Type de client</Label>
                      <Select value={editForm.client_type} onValueChange={(value) => setEditForm({ ...editForm, client_type: value as ClientType })}>
                        <SelectTrigger id="edit-client-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="particulier">Particulier</SelectItem>
                          <SelectItem value="association">Association</SelectItem>
                          <SelectItem value="entreprise">Entreprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editForm.client_type !== "particulier" && (
                      <>
                        <div className="grid gap-2 lg:col-span-2">
                          <Label htmlFor="edit-legal-name">{bookingFieldLabel("legalName", editForm.client_type)}</Label>
                          <Input id="edit-legal-name" value={editForm.legal_name} onChange={(e) => setEditForm({ ...editForm, legal_name: e.target.value })} />
                        </div>
                        {getVisibleBookingFields(editForm.client_type).includes("siret") && (
                        <div className="grid gap-2">
                          <Label htmlFor="edit-siret">SIRET</Label>
                          <Input id="edit-siret" value={editForm.siret} onChange={(e) => setEditForm({ ...editForm, siret: e.target.value })} />
                        </div>
                        )}
                        {getVisibleBookingFields(editForm.client_type).includes("rna") && (
                        <div className="grid gap-2">
                          <Label htmlFor="edit-rna">RNA</Label>
                          <Input id="edit-rna" value={editForm.rna} onChange={(e) => setEditForm({ ...editForm, rna: e.target.value })} />
                        </div>
                        )}
                      </>
                    )}
                    <div className="grid gap-2 lg:col-span-2">
                      <Label htmlFor="edit-instagram">Compte(s) Instagram</Label>
                      <Input id="edit-instagram" value={editForm.instagram_accounts} onChange={(e) => setEditForm({ ...editForm, instagram_accounts: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-name">Nom</Label>
                      <Input
                        id="edit-name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-phone">Téléphone</Label>
                      <Input
                        id="edit-phone"
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-band">Groupe / Artiste</Label>
                      <Input
                        id="edit-band"
                        value={editForm.band_name}
                        onChange={(e) => setEditForm({ ...editForm, band_name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2 lg:col-span-2">
                      <Label htmlFor="edit-notes">Notes internes</Label>
                      <textarea
                        id="edit-notes"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        rows={3}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
                      />
                    </div>
                    <div className="grid gap-2 lg:col-span-2">
                      <p className="text-sm font-medium text-zinc-400">Adresse</p>
                    </div>
                    <div className="grid gap-2 lg:col-span-2">
                      <Label htmlFor="edit-address-line1">Nom et numéro de rue</Label>
                      <Input
                        id="edit-address-line1"
                        value={editForm.address_line1}
                        onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
                        placeholder="123 rue de la Musique"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-postal-code">Code postal</Label>
                      <Input
                        id="edit-postal-code"
                        value={editForm.postal_code}
                        onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                        placeholder="94370"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-city">Ville</Label>
                      <Input
                        id="edit-city"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        placeholder="Sucy-en-Brie"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const clientIdentity = resolveUserClientIdentity(user);
                      return (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-zinc-400" /><div><p className="text-xs text-zinc-500">Type de client</p><p>{clientIdentity.clientTypeLabel}</p></div></div>
                          {clientIdentity.isBusiness && <>
                            <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-zinc-400" /><div><p className="text-xs text-zinc-500">{bookingFieldLabel("legalName", clientIdentity.clientType)}</p><p>{clientIdentity.legalName || "—"}</p></div></div>
                            {getVisibleBookingFields(clientIdentity.clientType).includes("siret") && <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-zinc-400" /><div><p className="text-xs text-zinc-500">SIRET</p><p>{clientIdentity.siret ? formatSiret(clientIdentity.siret) : "—"}</p></div></div>}
                            {getVisibleBookingFields(clientIdentity.clientType).includes("rna") && <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-zinc-400" /><div><p className="text-xs text-zinc-500">RNA</p><p>{clientIdentity.rna || "—"}</p></div></div>}
                          </>}
                          <div className="flex items-center gap-3"><Instagram className="h-5 w-5 text-zinc-400" /><div><p className="text-xs text-zinc-500">Compte(s) Instagram</p><p>{clientIdentity.instagramAccounts || "—"}</p></div></div>
                        </div>
                      );
                    })()}
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-xs text-zinc-500">Email</p>
                          <p>{user.email || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-xs text-zinc-500">Téléphone</p>
                          <p>{user.phone || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Music className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-xs text-zinc-500">Groupe / Artiste</p>
                          <p>{user.band_name || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-xs text-zinc-500">Inscrit le</p>
                          <p>{formatDate(user.created_at)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-4">
                      <p className="text-sm font-medium text-zinc-400 mb-3">Adresse</p>
                      <div className="grid gap-2 text-sm">
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-zinc-500">Nom et numéro de rue</span>
                          <span className="col-span-2">{user.address_line1 || "—"}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-zinc-500">Code postal</span>
                          <span className="col-span-2">{user.postal_code || "—"}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-zinc-500">Ville</span>
                          <span className="col-span-2">{user.city || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                          <StickyNote className="h-4 w-4" />
                          Notes internes
                        </p>
                        {!notesEditing && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setNotesDraft(user.notes || "");
                              setNotesEditing(true);
                            }}
                            className="gap-1"
                          >
                            <Edit className="h-4 w-4" />
                            {user.notes ? "Modifier" : "Ajouter"}
                          </Button>
                        )}
                      </div>
                      {notesEditing ? (
                        <div className="space-y-3">
                          <textarea
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                            rows={4}
                            placeholder="Préférences, contexte, points d'attention…"
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveNotes} disabled={notesSaving} className="gap-1">
                              <Save className="h-4 w-4" />
                              {notesSaving ? "Sauvegarde..." : "Enregistrer"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelNotes} disabled={notesSaving}>
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ) : user.notes ? (
                        <div className="rounded-lg bg-zinc-800 p-3">
                          <p className="text-sm whitespace-pre-wrap">{user.notes}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">Aucune note interne.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Remise de fidélité — super-admin uniquement */}
              {isSuperAdmin && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold">Remise de fidélité</h2>
                    {loyaltyEnabled ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Activée</Badge>
                    ) : (
                      <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-xs">Désactivée</Badge>
                    )}
                  </div>
                  {loyaltyEditing ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveLoyalty} disabled={loyaltySaving} className="gap-1">
                        <Save className="h-4 w-4" />
                        {loyaltySaving ? "Sauvegarde..." : "Enregistrer"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelLoyalty}
                        disabled={loyaltySaving}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLoyaltyEditing(true)}
                      className="gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Modifier
                    </Button>
                  )}
                </div>

                {loyaltyEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                      <div>
                        <p className="font-medium text-sm">Activer la remise de fidélité</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Le client bénéficie d'une remise automatique après un nombre défini de réservations.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={loyaltyForm.enabled}
                        aria-label="Activer la remise de fidélité"
                        onClick={() => setLoyaltyForm({ ...loyaltyForm, enabled: !loyaltyForm.enabled })}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${loyaltyForm.enabled ? "bg-primary" : "bg-zinc-700"}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${loyaltyForm.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>

                    {loyaltyForm.enabled && (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="loyalty-discount-type">Type de remise</Label>
                          <Select
                            value={loyaltyForm.discountType}
                            onValueChange={(value) => setLoyaltyForm({ ...loyaltyForm, discountType: value as LoyaltyDiscountType })}
                          >
                            <SelectTrigger id="loyalty-discount-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Pourcentage</SelectItem>
                              <SelectItem value="fixed">Montant fixe</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="loyalty-value">
                            Valeur de la remise ({loyaltyForm.discountType === "percentage" ? "%" : "€"})
                          </Label>
                          <Input
                            id="loyalty-value"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={loyaltyForm.discountType === "percentage" ? 100 : undefined}
                            step={loyaltyForm.discountType === "percentage" ? 1 : 0.5}
                            value={loyaltyForm.value}
                            onChange={(e) => setLoyaltyForm({ ...loyaltyForm, value: e.target.value })}
                            placeholder={loyaltyForm.discountType === "percentage" ? "Ex. 10" : "Ex. 15"}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="loyalty-threshold">Seuil (nombre de réservations)</Label>
                          <Input
                            id="loyalty-threshold"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={loyaltyForm.threshold}
                            onChange={(e) => setLoyaltyForm({ ...loyaltyForm, threshold: e.target.value })}
                            placeholder="Ex. 10"
                          />
                          <p className="text-xs text-zinc-500">
                            Une remise est accordée chaque fois que ce nombre de réservations comptabilisées est atteint, puis le compteur repart à zéro.
                          </p>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="loyalty-validity-days">Durée de validité du code (jours)</Label>
                          <Input
                            id="loyalty-validity-days"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={loyaltyForm.validityDays}
                            onChange={(e) => setLoyaltyForm({ ...loyaltyForm, validityDays: e.target.value })}
                            placeholder="Ex. 60"
                          />
                          <p className="text-xs text-zinc-500">
                            Délai avant expiration du code envoyé au client à chaque palier atteint.
                          </p>
                        </div>
                      </div>
                    )}

                    {loyaltyError && (
                      <p className="text-sm text-red-400">{loyaltyError}</p>
                    )}
                  </div>
                ) : loyaltyEnabled ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Remise accordée</span>
                        <span className="font-semibold text-primary">{loyaltyDiscountLabel}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Fréquence</span>
                        <span className="font-semibold">
                          {loyaltyThreshold > 1 ? `Toutes les ${loyaltyThreshold} réservations` : "À chaque réservation"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-sm">Durée de validité du code</span>
                        <span className="font-semibold">{loyaltyCodeValidityDays} jours</span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-zinc-400">Progression</p>
                        {loyaltyProgress?.isDue && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            Remise à appliquer
                          </Badge>
                        )}
                      </div>
                      {loyaltyProgress ? (
                        <>
                          <div className="space-y-1.5">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${loyaltyProgressPct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-zinc-500">
                              <span>{loyaltyProgress.counter} / {loyaltyProgress.threshold} réservations</span>
                              {loyaltyProgress.isDue ? (
                                <span className="text-emerald-400">Seuil atteint</span>
                              ) : (
                                <span>
                                  Encore {loyaltyProgress.remainingToNextAward} réservation{loyaltyProgress.remainingToNextAward > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-sm">Réservations comptabilisées</span>
                              <span className="font-semibold">{loyaltyProgress.pastEligibleBookings}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-sm">Remises déjà accordées</span>
                              <span className="font-semibold">{loyaltyProgress.awardsGranted}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400 text-sm">Total des remises fidélité utilisées</span>
                              <span className="font-semibold">{formatPrice(loyaltyProgress.totalDiscountGranted ?? 0)}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-500">Données de progression indisponibles.</p>
                      )}
                    </div>

                    <div className="border-t border-zinc-800 pt-4">
                      <p className="text-xs text-zinc-500">
                        Seules les réservations passées, confirmées ou terminées, sont comptées ; les annulations et les absences sont exclues.
                        Une fois le palier atteint, le code est envoyé par email au passage automatique de 6h, puis le compteur repart de zéro :
                        les réservations excédentaires ne sont pas reportées sur le cycle suivant.
                        La remise ne s'applique pas d'elle-même, le client saisit son code en réservant : elle exclut tout autre code promo,
                        et une remise manuelle ajoutée sur la réservation la remplace.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-700 p-4">
                    <p className="text-sm text-zinc-400">Aucune remise n'est configurée pour ce client.</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      La remise de fidélité est inactive par défaut. Elle ne s'applique qu'aux clients pour lesquels elle est explicitement activée.
                    </p>
                  </div>
                )}

                {/* Codes fidélité générés pour ce client — toujours visible, y
                    compris si la remise a depuis été désactivée : les codes
                    déjà émis restent une trace utile. Même vocabulaire
                    d'états que l'onglet Codes Promo. Seule la date
                    d'expiration est modifiable, et seulement par un
                    super-admin (isSuperAdmin) : un opérateur voit la
                    même table sans affordance d'édition. */}
                <div className="mt-6 border-t border-zinc-800 pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-zinc-500" />
                    <h3 className="text-sm font-medium text-zinc-300">
                      Codes générés pour ce client {loyaltyCodes.length > 0 ? `(${loyaltyCodes.length})` : ""}
                    </h3>
                  </div>
                  {loyaltyCodes.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Aucun code fidélité n'a encore été généré pour ce client.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-zinc-800">
                      <table className="w-full">
                        <thead className="border-b border-zinc-800 bg-zinc-900/50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">Code</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">Remise</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">Émis le</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">Expiration</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">État</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {loyaltyCodes.map((code) => {
                            const status = getLoyaltyCodeStatus(code, todayISO);
                            const statusBadge = loyaltyStatusBadgeProps(status);
                            const notNotified = !code.notified_at;
                            const resendable = isLoyaltyCodeResendable(code, todayISO);

                            return (
                              <tr
                                key={code.id}
                                className={`bg-zinc-900/30 transition-colors hover:bg-zinc-800/50 ${
                                  notNotified ? "bg-amber-500/[0.04]" : ""
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <span className="font-mono text-sm font-semibold tracking-wider">
                                    {code.code}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-medium text-primary">
                                    {formatLoyaltyDiscount(code)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-400">
                                  {formatDate(code.created_at)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`text-sm tabular-nums ${
                                        status === "expired" ? "text-red-400" : "text-zinc-400"
                                      }`}
                                    >
                                      {code.expires_at ? formatDate(code.expires_at) : "—"}
                                    </span>
                                    {isSuperAdmin && (
                                      <LoyaltyCodeExpiryEditor
                                        promo={code}
                                        onUpdated={(updated) =>
                                          handleLoyaltyCodeExpiryUpdated(code.id, updated.expires_at)
                                        }
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
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
                                        promo={code}
                                        onResent={(updated) => handleLoyaltyCodeResent(code.id, updated.notified_at)}
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
              </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 font-semibold">Statistiques</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Annulations</span>
                    <span className="font-semibold">
                      {user.ops ? formatCountRate(user.ops.cancelledBookings, user.ops.totalBookings) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Absences</span>
                    <span className="font-semibold">
                      {user.ops ? formatCountRate(user.ops.noShowBookings, user.ops.totalBookings) : "—"}
                    </span>
                  </div>
                  <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Durée totale</span>
                    <span className="font-semibold">{formatDurationHours(totalHours)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Durée moyenne</span>
                    <span className="font-semibold">{bookingInsights?.averageDurationLabel ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Client depuis</span>
                    <span className="text-sm font-medium">{firstBookingDate ? formatDate(firstBookingDate) : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Fréquence</span>
                    <span className="font-semibold">
                      {freqMensuelle
                        ? `${freqMensuelle} session${freqMensuelle === "1" ? "" : "s"} / mois`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Dernière réservation</span>
                    <span className="text-sm font-medium">{lastBookingDate ? formatDate(lastBookingDate) : "—"}</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Jour préféré</span>
                    <span className="font-semibold">{bookingInsights?.preferredWeekday ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Créneau préféré</span>
                    <span className="font-semibold">{bookingInsights?.preferredStartTime ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Studio favori</span>
                    <span className="font-semibold">
                      {bookingInsights?.preferredStudioId ? studioLabel(bookingInsights.preferredStudioId) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Formule préférée</span>
                    <span className="font-semibold">
                      {bookingInsights?.preferredGroupType
                        ? groupTypeLabel(bookingInsights.preferredGroupType)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 font-semibold">Actions</h2>
                <Button
                  onClick={handleBlock}
                  variant={user.is_blocked === 1 ? "outline" : "destructive"}
                  className="w-full gap-2"
                >
                  <Ban className="h-4 w-4" />
                  {user.is_blocked === 1 ? "Débloquer" : "Bloquer"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bookings">
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
                  className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="all">Date</option>
                  <option value="today">Auj.</option>
                  <option value="week">Sem.</option>
                  <option value="month">Mois</option>
                  <option value="upcoming">À venir</option>
                  <option value="past">Passées</option>
                  <option value="custom">Perso.</option>
                </select>
                {dateFilter === "custom" && (
                  <>
                    <input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 text-xs focus:border-primary focus:outline-none"
                    />
                    <input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 text-xs focus:border-primary focus:outline-none"
                    />
                  </>
                )}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as BookingStatus | "all")}
                  className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="all">Statut</option>
                  <option value="confirmed">Confirmé</option>
                  <option value="completed">Terminé</option>
                  <option value="cancelled">Annulé</option>
                  <option value="no-show">Absent</option>
                </select>
                <select
                  value={studioFilter}
                  onChange={(e) => setStudioFilter(e.target.value as StudioId | "all")}
                  className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="all">Studio</option>
                  <option value="la-scene">La Scène</option>
                  <option value="le-podium">Le Podium</option>
                </select>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value as "all" | "paid" | "remaining")}
                  className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="all">Paiement</option>
                  <option value="paid">Payé</option>
                  <option value="remaining">Reste à payer</option>
                </select>
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-[10px] text-zinc-500">Tri</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as BookingSortField)}
                    className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="date">Date</option>
                    <option value="start_time">Heure</option>
                    <option value="total_price">€</option>
                    <option value="status">Statut</option>
                    <option value="payment_status">Paiement</option>
                    <option value="created_at">Créé</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as BookingSortOrder)}
                    className="h-7 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="desc">↓</option>
                    <option value="asc">↑</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-semibold">
                  Réservations ({sortedBookings.length})
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    Exporter CSV
                  </Button>
                  <a href={`/admin/bookings/new?userId=${user.id}`}>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Nouvelle réservation
                    </Button>
                  </a>
                </div>
              </div>
              {sortedBookings.length === 0 ? (
                <p className="text-zinc-400">Aucune réservation trouvée</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <table className="w-full">
                    <thead className="border-b border-zinc-800 bg-zinc-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "date") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("date"); } }}>
                          Date {sortBy === "date" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "start_time") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("start_time"); } }}>
                          Créneau {sortBy === "start_time" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Studio</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "status") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("status"); } }}>
                          Statut {sortBy === "status" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "payment_status") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("payment_status"); } }}>
                          Paiement {sortBy === "payment_status" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-200" onClick={() => { if (sortBy === "total_price") { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); } else { setSortBy("total_price"); } }}>
                          Montant {sortBy === "total_price" && (sortOrder === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />)}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {sortedBookings.map((b) => (
                        <tr key={b.id} className="bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <a href={`/admin/bookings/${b.id}`} className="font-mono text-sm text-primary hover:underline block">
                              {b.booking_ref}
                            </a>
                            <span className="text-xs text-zinc-500">{formatDate(b.date)}</span>
                          </td>
                          <td className="px-4 py-3 text-sm">{b.start_time} - {b.end_time}</td>
                          <td className="px-4 py-3 text-sm">{studioLabel(b.studio_id)}</td>
                          <td className="px-4 py-3 text-sm">{groupTypeLabel(b.group_type)}</td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${
                              b.status === 'confirmed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              b.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                              b.status === 'cancelled' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }`}>
                              {bookingStatusLabel(b.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const payDisplay = getDisplayPaymentStatusFromSummary(
                                b.status,
                                b.payment_status,
                                b.total_collected ?? b.total_paid ?? 0,
                                b.total_refunded ?? 0,
                                { keepBalanceDue: isKeepBalanceDue(b), remaining: b.remaining ?? 0 },
                              );
                              if (payDisplay === "cancelled") {
                                return <span className="text-zinc-600">—</span>;
                              }
                              if (payDisplay === "paid") {
                                return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">{displayPaymentStatusLabel(payDisplay)}</Badge>;
                              }
                              if (payDisplay === "paid-before-cancel" || payDisplay === "refunded") {
                                return <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-xs">{displayPaymentStatusLabel(payDisplay)}</Badge>;
                              }
                              const remaining = b.remaining;
                              return (
                                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                                  {remaining != null && remaining > 0 ? `Reste ${formatPrice(remaining)}` : displayPaymentStatusLabel(payDisplay)}
                                </Badge>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {b.status === "cancelled" && !isKeepBalanceDue(b) ? (
                              <span className="font-medium text-zinc-600">—</span>
                            ) : (
                              <>
                                <span className="font-medium">{formatPrice(b.remaining ?? getBookingAmountDue(b))}</span>
                                {b.promo_discount > 0 && (
                                  <p className="text-xs text-emerald-500">-{formatPrice(b.promo_discount)}</p>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">Paiements ({payments.length})</h2>
            {payments.length === 0 ? (
              <p className="text-zinc-400">Aucun paiement enregistré</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-800">
                <table className="w-full">
                  <thead className="border-b border-zinc-800 bg-zinc-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Réservation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Moyen</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Statut</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          {payment.created_at ? formatDate(payment.created_at) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {payment.booking_id ? (
                            <a href={`/admin/bookings/${payment.booking_id}`} className="font-mono text-sm text-primary hover:underline">
                              {payment.booking_ref || payment.booking_id}
                            </a>
                          ) : (
                            <span className="text-sm text-zinc-500">—</span>
                          )}
                          {payment.booking_date && (
                            <p className="text-xs text-zinc-500">{formatDate(payment.booking_date)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{paymentMethodLabelShort(payment.method)}</td>
                        <td className="px-4 py-3 text-sm">{paymentTypeLabel(payment.payment_type)}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${
                            payment.status === "paid" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                            payment.status === "pending" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                            "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                          }`}>
                            {paymentRecordStatusLabel(payment.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">{formatPrice(payment.amount)}</span>
                          {payment.refunded_amount > 0 && (
                            <p className="text-xs text-zinc-500">-{formatPrice(payment.refunded_amount)}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
