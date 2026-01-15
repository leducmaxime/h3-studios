"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  ChevronLeft,
  User,
  Mail,
  Phone,
  Music,
  Calendar,
  CreditCard,
  Ban,
  Edit,
  Save,
} from "lucide-react";
import {
  loadAdminStore,
  getBookingsByUser,
  blockUser,
  saveAdminStore,
  type AdminStore,
  type AdminUser,
  type AdminBooking,
} from "@/lib/admin-store";
import { STUDIOS, formatPrice } from "@/lib/booking";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

interface UserDetailProps {
  userId: string;
}

export function AdminUserDetail({ userId }: UserDetailProps) {
  const [store, setStore] = useState<AdminStore | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", bandName: "", notes: "" });

  useEffect(() => {
    const adminStore = loadAdminStore();
    setStore(adminStore);
    const found = adminStore.users.find(u => u.id === userId);
    if (found) {
      setUser(found);
      setEditForm({
        name: found.name,
        email: found.email,
        phone: found.phone,
        bandName: found.bandName,
        notes: found.notes,
      });
      setBookings(getBookingsByUser(adminStore, userId));
    }
  }, [userId]);

  const handleBlock = () => {
    if (!store || !user) return;
    blockUser(store, user.id, !user.isBlocked);
    setUser({ ...user, isBlocked: !user.isBlocked });
  };

  const handleSave = () => {
    if (!store || !user) return;
    
    const updated = {
      ...user,
      ...editForm,
      updatedAt: new Date(),
    };
    
    const idx = store.users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      store.users[idx] = updated;
      saveAdminStore(store);
      setUser(updated);
    }
    
    setEditing(false);
  };

  if (!store || !user) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  const upcomingBookings = bookings.filter(b => b.status === "confirmed" && b.date >= new Date().toISOString().slice(0, 10));
  const pastBookings = bookings.filter(b => b.status !== "confirmed" || b.date < new Date().toISOString().slice(0, 10));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <a href="/admin/users" className="rounded-lg p-2 hover:bg-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </a>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-zinc-400">Profil client</p>
          </div>
          {user.isBlocked && (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-400">
              Bloqué
            </span>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Informations</h2>
                {editing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-black hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4" />
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                  >
                    <Edit className="h-4 w-4" />
                    Modifier
                  </button>
                )}
              </div>

              {editing ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Nom</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Téléphone</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">Groupe / Artiste</label>
                    <input
                      type="text"
                      value={editForm.bandName}
                      onChange={(e) => setEditForm({ ...editForm, bandName: e.target.value })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm text-zinc-400">Notes internes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-zinc-400" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-zinc-400" />
                    <span>{user.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Music className="h-5 w-5 text-zinc-400" />
                    <span>{user.bandName || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-zinc-400" />
                    <span>Inscrit le {formatDate(user.createdAt.toISOString().slice(0, 10))}</span>
                  </div>
                  {user.notes && (
                    <div className="sm:col-span-2 rounded-lg bg-zinc-800 p-3">
                      <p className="text-sm text-zinc-400">Notes :</p>
                      <p className="text-sm">{user.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 font-semibold">Réservations à venir ({upcomingBookings.length})</h2>
              {upcomingBookings.length === 0 ? (
                <p className="text-zinc-400">Aucune réservation à venir</p>
              ) : (
                <div className="space-y-2">
                  {upcomingBookings.map((b) => (
                    <a
                      key={b.id}
                      href={`/admin/bookings/${b.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 p-3 hover:bg-zinc-800/50"
                    >
                      <div>
                        <p className="font-medium">{STUDIOS[b.studioId].name}</p>
                        <p className="text-sm text-zinc-400">
                          {formatDate(b.date)} • {b.startTime}-{b.endTime}
                        </p>
                      </div>
                      <span className="font-medium text-primary">{formatPrice(b.totalPrice)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 font-semibold">Historique ({pastBookings.length})</h2>
              {pastBookings.length === 0 ? (
                <p className="text-zinc-400">Aucun historique</p>
              ) : (
                <div className="space-y-2">
                  {pastBookings.slice(0, 10).map((b) => (
                    <a
                      key={b.id}
                      href={`/admin/bookings/${b.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 p-3 hover:bg-zinc-800/50"
                    >
                      <div>
                        <p className="font-medium">{STUDIOS[b.studioId].name}</p>
                        <p className="text-sm text-zinc-400">
                          {formatDate(b.date)} • {b.startTime}-{b.endTime}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{formatPrice(b.totalPrice)}</span>
                        <p className="text-xs text-zinc-500 capitalize">{b.status}</p>
                      </div>
                    </a>
                  ))}
                  {pastBookings.length > 10 && (
                    <p className="text-center text-sm text-zinc-400">
                      + {pastBookings.length - 10} autres réservations
                    </p>
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
                  <span className="text-lg font-semibold">{user.totalBookings}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Total dépensé</span>
                  <span className="text-lg font-semibold text-primary">{formatPrice(user.totalSpent)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 font-semibold">Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={handleBlock}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                    user.isBlocked
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  }`}
                >
                  <Ban className="h-4 w-4" />
                  {user.isBlocked ? "Débloquer" : "Bloquer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
