"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  User,
  Mail,
  Phone,
  Music,
  Calendar,
  Ban,
  Edit,
  Save,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  Building2,
  FileText,
  Instagram,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateISO } from "@/lib/utils";
import { formatSiret, resolveUserClientIdentity } from "@/lib/client-identity";
import { bookingFieldLabel, getVisibleBookingFields, isClientType, type ClientType } from "@/lib/booking-fields";
import { STUDIOS, formatPrice, type StudioId } from "@/lib/booking";
import { getBookingAmountDue, getDisplayPaymentStatusFromSummary, PAYMENT_STATUS_LABELS } from "@/lib/booking-totals";
import { type DbUser, type BookingWithUser, type BookingStatus, type BookingSortField, type BookingSortOrder } from "@/lib/db-types";
import { exportBookingsCSV } from "@/lib/export";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function getStudioName(studioId: string): string {
  const studio = STUDIOS[studioId as keyof typeof STUDIOS];
  return studio?.name ?? studioId;
}

function slotDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
  "no-show": "Absent",
};

// ─── Studio Pie Chart ─────────────────────────────────────────────────────
function StudioPieChart({ sceneCount, podiumCount }: { sceneCount: number; podiumCount: number }) {
  const total = sceneCount + podiumCount;
  if (total === 0) return <p className="text-sm text-zinc-400">Aucune donnée</p>;

  const r = 40;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * r;
  const scenePct = sceneCount / total;
  const podiumPct = podiumCount / total;
  const sceneDash = scenePct * circumference;
  const podiumDash = podiumPct * circumference;
  const podiumRotation = -90 + scenePct * 360;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 112 112">
        {/* Fond gris */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth="18" />
        {/* Le Podium */}
        {podiumCount > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#a78bfa"
            strokeWidth="18"
            strokeDasharray={`${podiumDash} ${circumference}`}
            strokeLinecap="butt"
            transform={`rotate(${podiumRotation} ${cx} ${cy})`}
          />
        )}
        {/* La Scène */}
        {sceneCount > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#ffde59"
            strokeWidth="18"
            strokeDasharray={`${sceneDash} ${circumference}`}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
      </svg>
      <div className="w-full space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffde59] shrink-0" />
            <span className="text-zinc-300">La Scène</span>
          </div>
          <span className="font-semibold">{Math.round(scenePct * 100)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#a78bfa] shrink-0" />
            <span className="text-zinc-300">Le Podium</span>
          </div>
          <span className="font-semibold">{Math.round(podiumPct * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

interface UserDetailProps {
  userId: string;
}

export function AdminUserDetail({ userId }: UserDetailProps) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [bookings, setBookings] = useState<BookingWithUser[]>([]);
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
      const json = (await res.json()) as { success: boolean; data?: DbUser; error?: string };
      if (json.success && json.data) {
        setUser(json.data);
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
      const params = new URLSearchParams({ userId: userId, limit: "100" });
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchUser(), fetchBookings()]);
      setLoading(false);
    };
    load();
  }, [fetchUser, fetchBookings]);

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
        setUser(json.data);
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

  const nonCancelledBookings = bookings.filter((b) => b.status !== "cancelled");
  const lastBooking = nonCancelledBookings.length > 0
    ? nonCancelledBookings.reduce((a, b) => (a.date > b.date ? a : b))
    : null;
  const firstBooking = nonCancelledBookings.length > 0
    ? nonCancelledBookings.reduce((a, b) => (a.date < b.date ? a : b))
    : null;
  const sceneCount = nonCancelledBookings.filter((b) => b.studio_id === "la-scene").length;
  const podiumCount = nonCancelledBookings.filter((b) => b.studio_id === "le-podium").length;
  // Panier moyen
  const totalSpentCalc = nonCancelledBookings.reduce(
    (acc, b) => acc + getBookingAmountDue(b), 0,
  );
  const panierMoyen = nonCancelledBookings.length > 0 ? totalSpentCalc / nonCancelledBookings.length : 0;

  // Durée totale
  const totalHours = nonCancelledBookings.reduce(
    (acc, b) => acc + slotDurationHours(b.start_time, b.end_time), 0,
  );

  // Ancienneté
  const monthsSinceFirst = firstBooking
    ? Math.max(1, Math.round((Date.now() - new Date(firstBooking.date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
    : 0;

  // Fréquence mensuelle
  const freqMensuelle = monthsSinceFirst > 1
    ? (nonCancelledBookings.length / monthsSinceFirst).toFixed(1)
    : nonCancelledBookings.length.toString();

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ")
    || user.name?.trim()
    || user.email
    || "—";

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
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="bookings">
            Réservations ({bookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
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
                      onClick={() => setEditing(true)}
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

                    {user.notes && (
                      <div className="border-t border-zinc-800 pt-4">
                        <p className="text-sm font-medium text-zinc-400 mb-2">Notes internes</p>
                        <div className="rounded-lg bg-zinc-800 p-3">
                          <p className="text-sm whitespace-pre-wrap">{user.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 font-semibold">Statistiques</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Total réservations</span>
                    <span className="font-semibold">{user.total_bookings}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Total dépensé</span>
                    <span className="font-semibold text-primary">{formatPrice(user.total_spent)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Panier moyen</span>
                    <span className="font-semibold">{nonCancelledBookings.length > 0 ? formatPrice(panierMoyen) : "—"}</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Durée totale</span>
                    <span className="font-semibold">
                      {totalHours >= 1
                        ? `${Math.floor(totalHours)}h${totalHours % 1 > 0 ? String(Math.round((totalHours % 1) * 60)).padStart(2, "0") : ""}`
                        : totalHours > 0 ? `${Math.round(totalHours * 60)}min` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Ancienneté</span>
                    <span className="font-semibold">{firstBooking ? `${monthsSinceFirst} mois` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Fréquence</span>
                    <span className="font-semibold">
                      {nonCancelledBookings.length > 0 ? `${freqMensuelle} / mois` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Dernière réservation</span>
                    <span className="text-sm font-medium">{lastBooking ? formatDate(lastBooking.date) : "—"}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 font-semibold">Répartition studios</h2>
                <StudioPieChart sceneCount={sceneCount} podiumCount={podiumCount} />
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
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">
                  Réservations ({sortedBookings.length})
                </h2>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Exporter CSV
                </Button>
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
                        <tr key={b.id} className={`bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors ${b.date < today ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <a href={`/admin/bookings/${b.id}`} className="font-mono text-sm text-primary hover:underline block">
                              {b.booking_ref}
                            </a>
                            <span className="text-xs text-zinc-500">{formatDate(b.date)}</span>
                          </td>
                          <td className="px-4 py-3 text-sm">{b.start_time} - {b.end_time}</td>
                          <td className="px-4 py-3 text-sm">{getStudioName(b.studio_id)}</td>
                          <td className="px-4 py-3 text-sm capitalize">{b.group_type}</td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${
                              b.status === 'confirmed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              b.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                              b.status === 'cancelled' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }`}>
                              {STATUS_LABELS[b.status] || b.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const payDisplay = getDisplayPaymentStatusFromSummary(
                                b.status,
                                b.payment_status,
                                b.total_collected ?? b.total_paid ?? 0,
                                b.total_refunded ?? 0,
                              );
                              if (payDisplay === "paid") {
                                return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Payé</Badge>;
                              }
                              if (payDisplay === "cancelled" || payDisplay === "paid-before-cancel" || payDisplay === "refunded") {
                                return <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-xs">{PAYMENT_STATUS_LABELS[payDisplay]}</Badge>;
                              }
                              if (b.payment_status === "pay-on-site") {
                                return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Sur place</Badge>;
                              }
                              return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Reste à payer</Badge>;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {b.status === "cancelled" ? (
                              <span className="font-medium text-zinc-600">—</span>
                            ) : (
                              <>
                                <span className="font-medium">{formatPrice(getBookingAmountDue(b))}</span>
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
      </Tabs>
    </div>
  );
}
