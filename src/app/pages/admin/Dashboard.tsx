"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  Calendar,
  CreditCard,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  loadAdminStore,
  getStats,
  type AdminStore,
  type AdminBooking,
} from "@/lib/admin-store";
import { STUDIOS, formatPrice } from "@/lib/booking";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  color = "primary",
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: string;
  color?: "primary" | "green" | "red" | "blue";
}) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    blue: "bg-blue-500/10 text-blue-500",
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {subValue && <p className="mt-1 text-sm text-zinc-500">{subValue}</p>}
        </div>
        <div className={`rounded-lg p-2 ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <p className="mt-2 text-xs text-green-500">{trend}</p>
      )}
    </div>
  );
}

function BookingRow({ booking, users }: { booking: AdminBooking; users: AdminStore["users"] }) {
  const user = users.find(u => u.id === booking.userId);
  const studio = STUDIOS[booking.studioId];

  return (
    <a
      href={`/admin/bookings/${booking.id}`}
      className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:bg-zinc-800/50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Clock className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{user?.name || "Client inconnu"}</p>
        <p className="text-sm text-zinc-400">
          {studio.name} • {booking.startTime}-{booking.endTime}
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium text-primary">{formatPrice(booking.totalPrice)}</p>
        <p className="text-xs text-zinc-500">{formatDate(booking.date)}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600" />
    </a>
  );
}

export function AdminDashboard() {
  const [store, setStore] = useState<AdminStore | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof getStats> | null>(null);

  useEffect(() => {
    const adminStore = loadAdminStore();
    setStore(adminStore);
    setStats(getStats(adminStore));
  }, []);

  if (!store || !stats) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  const pendingPayments = store.payments.filter(p => p.status === "pending");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tableau de bord</h1>
            <p className="text-zinc-400">Vue d'ensemble de votre activité</p>
          </div>
          <a
            href="/admin/bookings/new"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-black transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nouvelle réservation
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Réservations aujourd'hui"
            value={stats.todayBookings}
            subValue={`${stats.occupancyToday}% d'occupation`}
            icon={Calendar}
            color="primary"
          />
          <StatCard
            title="Revenu du jour"
            value={formatPrice(stats.todayRevenue)}
            subValue={`${stats.weekBookings} résa. cette semaine`}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Paiements en attente"
            value={stats.pendingPayments}
            subValue={formatPrice(stats.pendingAmount)}
            icon={CreditCard}
            color={stats.pendingPayments > 0 ? "red" : "blue"}
          />
          <StatCard
            title="Revenu mensuel"
            value={formatPrice(stats.monthRevenue)}
            subValue={`${stats.monthBookings} réservations`}
            icon={Users}
            color="blue"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Prochaines réservations</h2>
              <a
                href="/admin/bookings"
                className="text-sm text-primary hover:underline"
              >
                Voir tout
              </a>
            </div>
            <div className="space-y-2">
              {stats.upcomingBookings.length === 0 ? (
                <p className="py-8 text-center text-zinc-500">
                  Aucune réservation à venir
                </p>
              ) : (
                stats.upcomingBookings.slice(0, 5).map((booking) => (
                  <BookingRow key={booking.id} booking={booking} users={store.users} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Paiements en attente</h2>
              <a
                href="/admin/payments?status=pending"
                className="text-sm text-primary hover:underline"
              >
                Voir tout
              </a>
            </div>
            <div className="space-y-2">
              {pendingPayments.length === 0 ? (
                <p className="py-8 text-center text-zinc-500">
                  Aucun paiement en attente
                </p>
              ) : (
                pendingPayments.slice(0, 5).map((payment) => {
                  const booking = store.bookings.find(b => b.id === payment.bookingId);
                  const user = booking ? store.users.find(u => u.id === booking.userId) : null;
                  
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-500">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user?.name || "Client inconnu"}</p>
                        <p className="text-sm text-zinc-400">
                          {booking ? `${formatDate(booking.date)} • ${booking.startTime}` : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-yellow-500">{formatPrice(payment.amount)}</p>
                        <p className="text-xs text-zinc-500">Espèces</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-4 font-semibold">Accès rapide</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/admin/calendar"
              className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Calendrier</p>
                <p className="text-sm text-zinc-400">Vue planning</p>
              </div>
            </a>
            <a
              href="/admin/bookings"
              className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Clock className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Réservations</p>
                <p className="text-sm text-zinc-400">Gérer les créneaux</p>
              </div>
            </a>
            <a
              href="/admin/users"
              className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Users className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Clients</p>
                <p className="text-sm text-zinc-400">{store.users.length} inscrits</p>
              </div>
            </a>
            <a
              href="/admin/studios"
              className="flex items-center gap-3 rounded-lg border border-zinc-700 p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <TrendingUp className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Studios</p>
                <p className="text-sm text-zinc-400">Configuration</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
