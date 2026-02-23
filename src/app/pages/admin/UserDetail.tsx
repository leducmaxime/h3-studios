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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDateISO } from "@/lib/utils";
import { STUDIOS, formatPrice } from "@/lib/booking";
import { type DbUser, type DbBooking } from "@/lib/db-types";

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
  "no-show": "No-show",
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
  const [bookings, setBookings] = useState<DbBooking[]>([]);
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
  });

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
        data?: { data: DbBooking[]; total: number };
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
  const upcomingBookings = bookings.filter(
    (b) => b.status === "confirmed" && b.date >= today,
  );
  const pastBookings = bookings.filter(
    (b) => b.status !== "confirmed" || b.date < today,
  );

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
    (acc, b) => acc + Math.max(0, (b.total_price || 0) - (b.promo_discount || 0)), 0,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <a href="/admin/users" className="rounded-lg p-2 hover:bg-zinc-800">
          <ChevronLeft className="h-5 w-5" />
        </a>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{user.name}</h1>
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
            Réservations ({upcomingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Historique ({pastBookings.length})
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
                  <div className="grid gap-4 sm:grid-cols-2">
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
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="edit-notes">Notes internes</Label>
                      <textarea
                        id="edit-notes"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        rows={3}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30"
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <p className="text-sm font-medium text-zinc-400">Adresse</p>
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
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
                    <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">
              Réservations à venir ({upcomingBookings.length})
            </h2>
            {upcomingBookings.length === 0 ? (
              <p className="text-zinc-400">Aucune réservation à venir</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-800">
                <table className="w-full">
                  <thead className="border-b border-zinc-800 bg-zinc-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Référence</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Créneau</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Studio</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Paiement</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {upcomingBookings.map((b) => (
                      <tr key={b.id} className="bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <a href={`/admin/bookings/${b.id}`} className="font-mono text-sm text-primary hover:underline">
                            {b.booking_ref}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDate(b.date)}</td>
                        <td className="px-4 py-3 text-sm">{b.start_time} - {b.end_time}</td>
                        <td className="px-4 py-3 text-sm">{getStudioName(b.studio_id)}</td>
                        <td className="px-4 py-3 text-sm capitalize">{b.group_type}</td>
                        <td className="px-4 py-3">
                          {b.payment_status === "paid" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Payé</Badge>
                          ) : b.payment_status === "pay-on-site" ? (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Sur place</Badge>
                          ) : (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Reste à payer</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">{formatPrice((b.total_price || 0) - (b.promo_discount || 0))}</span>
                          {b.promo_discount > 0 && (
                            <p className="text-xs text-emerald-500">-{formatPrice(b.promo_discount)}</p>
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

        <TabsContent value="history">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">
              Historique ({pastBookings.length})
            </h2>
            {pastBookings.length === 0 ? (
              <p className="text-zinc-400">Aucun historique</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-800">
                <table className="w-full">
                  <thead className="border-b border-zinc-800 bg-zinc-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Référence</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Créneau</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Studio</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Paiement</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {pastBookings.slice(0, 20).map((b) => (
                      <tr key={b.id} className="bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <a href={`/admin/bookings/${b.id}`} className="font-mono text-sm text-primary hover:underline">
                            {b.booking_ref}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDate(b.date)}</td>
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
                          {b.payment_status === "paid" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Payé</Badge>
                          ) : b.payment_status === "pay-on-site" ? (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Sur place</Badge>
                          ) : (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Reste à payer</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">{formatPrice((b.total_price || 0) - (b.promo_discount || 0))}</span>
                          {b.promo_discount > 0 && (
                            <p className="text-xs text-emerald-500">-{formatPrice(b.promo_discount)}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pastBookings.length > 20 && (
                  <p className="text-center text-sm text-zinc-400 py-3 border-t border-zinc-800">
                    + {pastBookings.length - 20} autres réservations
                  </p>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
