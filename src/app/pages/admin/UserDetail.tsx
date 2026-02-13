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

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
  "no-show": "No-show",
};

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
        });
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      toast.error("Erreur lors du chargement du profil");
    }
  }, [userId]);

  const fetchBookings = useCallback(async () => {
    try {
      const params = new URLSearchParams({ search: userId, limit: "100" });
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

  const today = new Date().toISOString().slice(0, 10);
  const upcomingBookings = bookings.filter(
    (b) => b.status === "confirmed" && b.date >= today,
  );
  const pastBookings = bookings.filter(
    (b) => b.status !== "confirmed" || b.date < today,
  );

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
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-zinc-400" />
                      <span>{user.email || "—"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-zinc-400" />
                      <span>{user.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Music className="h-5 w-5 text-zinc-400" />
                      <span>{user.band_name || "—"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-zinc-400" />
                      <span>Inscrit le {formatDate(user.created_at)}</span>
                    </div>
                    {user.notes && (
                      <div className="rounded-lg bg-zinc-800 p-3 sm:col-span-2">
                        <p className="text-sm text-zinc-400">Notes :</p>
                        <p className="text-sm">{user.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 font-semibold">Statistiques</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Total réservations</span>
                    <span className="text-lg font-semibold">{user.total_bookings}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Total dépensé</span>
                    <span className="text-lg font-semibold text-primary">
                      {formatPrice(user.total_spent)}
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 font-semibold">
              Réservations à venir ({upcomingBookings.length})
            </h2>
            {upcomingBookings.length === 0 ? (
              <p className="text-zinc-400">Aucune réservation à venir</p>
            ) : (
              <div className="space-y-2">
                {upcomingBookings.map((b) => (
                  <a
                    key={b.id}
                    href={`/admin/bookings/${b.id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 p-3 transition-colors hover:bg-zinc-800/50"
                  >
                    <div>
                      <p className="font-medium">{getStudioName(b.studio_id)}</p>
                      <p className="text-sm text-zinc-400">
                        {formatDate(b.date)} &bull; {b.start_time}-{b.end_time}
                      </p>
                    </div>
                    <span className="font-medium text-primary">
                      {formatPrice(b.total_price)}
                    </span>
                  </a>
                ))}
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
              <div className="space-y-2">
                {pastBookings.slice(0, 20).map((b) => (
                  <a
                    key={b.id}
                    href={`/admin/bookings/${b.id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 p-3 transition-colors hover:bg-zinc-800/50"
                  >
                    <div>
                      <p className="font-medium">{getStudioName(b.studio_id)}</p>
                      <p className="text-sm text-zinc-400">
                        {formatDate(b.date)} &bull; {b.start_time}-{b.end_time}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{formatPrice(b.total_price)}</span>
                      <p className="text-xs text-zinc-500">
                        {STATUS_LABELS[b.status] || b.status}
                      </p>
                    </div>
                  </a>
                ))}
                {pastBookings.length > 20 && (
                  <p className="text-center text-sm text-zinc-400">
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
