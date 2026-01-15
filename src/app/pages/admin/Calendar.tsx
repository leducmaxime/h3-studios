"use client";

import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
} from "lucide-react";
import {
  loadAdminStore,
  getBookingsByDate,
  type AdminStore,
  type AdminBooking,
} from "@/lib/admin-store";
import { STUDIOS, formatPrice, TIME_SLOTS, type StudioId } from "@/lib/booking";

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

const VISIBLE_HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];

export function AdminCalendar() {
  const [store, setStore] = useState<AdminStore | null>(null);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [view, setView] = useState<"day" | "week">("day");

  useEffect(() => {
    setStore(loadAdminStore());
  }, []);

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay() + 1);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentDate]);

  const goToPrev = () => {
    setCurrentDate((d) => {
      const newDate = new Date(d);
      newDate.setDate(d.getDate() - (view === "week" ? 7 : 1));
      return newDate;
    });
  };

  const goToNext = () => {
    setCurrentDate((d) => {
      const newDate = new Date(d);
      newDate.setDate(d.getDate() + (view === "week" ? 7 : 1));
      return newDate;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
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

  const renderDayView = () => {
    const dateStr = currentDate.toISOString().slice(0, 10);
    const dayBookings = getBookingsByDate(store, dateStr);
    const studios: StudioId[] = ["la-scene", "le-podium"];

    const getBookingStyle = (booking: AdminBooking) => {
      const startIdx = TIME_SLOTS.indexOf(booking.startTime);
      let endIdx = TIME_SLOTS.indexOf(booking.endTime);
      if (endIdx === -1) endIdx = TIME_SLOTS.length;
      const top = (startIdx - TIME_SLOTS.indexOf("09:00")) * 30;
      const height = (endIdx - startIdx) * 30;
      return { top: `${top}px`, height: `${height}px` };
    };

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[80px_1fr_1fr] border-b border-zinc-800">
            <div className="p-3 text-sm font-medium text-zinc-400"></div>
            {studios.map((studioId) => (
              <div key={studioId} className="border-l border-zinc-800 p-3 text-center">
                <p className="font-medium">{STUDIOS[studioId].name}</p>
                <p className="text-sm text-zinc-400">{STUDIOS[studioId].size}</p>
              </div>
            ))}
          </div>

          <div className="relative grid grid-cols-[80px_1fr_1fr]">
            <div className="border-r border-zinc-800">
              {VISIBLE_HOURS.map((hour) => (
                <div key={hour} className="h-[60px] border-b border-zinc-800 pr-3 pt-1 text-right text-xs text-zinc-500">
                  {hour}
                </div>
              ))}
            </div>

            {studios.map((studioId) => {
              const studioBookings = dayBookings.filter((b) => b.studioId === studioId);
              return (
                <div key={studioId} className="relative border-l border-zinc-800">
                  {VISIBLE_HOURS.map((hour) => (
                    <div key={hour} className="h-[60px] border-b border-zinc-800" />
                  ))}
                  {studioBookings.map((booking) => {
                    const user = store.users.find((u) => u.id === booking.userId);
                    const style = getBookingStyle(booking);
                    const statusColors: Record<string, string> = {
                      confirmed: "bg-primary/20 border-primary/50 text-primary",
                      completed: "bg-blue-500/20 border-blue-500/50 text-blue-400",
                      cancelled: "bg-red-500/20 border-red-500/50 text-red-400",
                      "no-show": "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
                    };
                    return (
                      <a
                        key={booking.id}
                        href={`/admin/bookings/${booking.id}`}
                        className={`absolute left-1 right-1 overflow-hidden rounded-lg border p-2 transition-opacity hover:opacity-80 ${statusColors[booking.status]}`}
                        style={style}
                      >
                        <p className="truncate text-sm font-medium">{user?.name || "Client"}</p>
                        <p className="truncate text-xs opacity-80">
                          {booking.startTime}-{booking.endTime} • {formatPrice(booking.totalPrice)}
                        </p>
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const studios: StudioId[] = ["la-scene", "le-podium"];

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-8 border-b border-zinc-800">
            <div className="p-3"></div>
            {weekDates.map((date) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={date.toISOString()}
                  className={`border-l border-zinc-800 p-3 text-center ${isToday ? "bg-primary/5" : ""}`}
                >
                  <p className={`text-sm ${isToday ? "text-primary font-medium" : "text-zinc-400"}`}>
                    {formatShortDate(date)}
                  </p>
                </div>
              );
            })}
          </div>

          {studios.map((studioId) => {
            return (
              <div key={studioId} className="grid grid-cols-8 border-b border-zinc-800">
                <div className="p-3 text-sm font-medium">{STUDIOS[studioId].name}</div>
                {weekDates.map((date) => {
                  const dateStr = date.toISOString().slice(0, 10);
                  const dayBookings = store.bookings.filter(
                    (b) => b.date === dateStr && b.studioId === studioId && b.status !== "cancelled"
                  );
                  const isToday = date.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[100px] border-l border-zinc-800 p-1 ${isToday ? "bg-primary/5" : ""}`}
                    >
                      {dayBookings.slice(0, 4).map((booking) => {
                        const user = store.users.find((u) => u.id === booking.userId);
                        return (
                          <a
                            key={booking.id}
                            href={`/admin/bookings/${booking.id}`}
                            className="mb-1 block truncate rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary hover:bg-primary/30"
                          >
                            {booking.startTime} {user?.name?.split(" ")[0] || "—"}
                          </a>
                        );
                      })}
                      {dayBookings.length > 4 && (
                        <span className="text-xs text-zinc-500">+{dayBookings.length - 4} autres</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Calendrier</h1>
            <p className="text-zinc-400">
              {view === "day" ? formatDateHeader(currentDate) : `Semaine du ${formatShortDate(weekDates[0])}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={goToToday}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              Aujourd'hui
            </button>
            <div className="flex rounded-lg border border-zinc-700">
              <button
                onClick={() => setView("day")}
                className={`px-3 py-2 text-sm ${view === "day" ? "bg-primary/20 text-primary" : "hover:bg-zinc-800"}`}
              >
                Jour
              </button>
              <button
                onClick={() => setView("week")}
                className={`px-3 py-2 text-sm ${view === "week" ? "bg-primary/20 text-primary" : "hover:bg-zinc-800"}`}
              >
                Semaine
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={goToPrev} className="rounded-lg p-2 hover:bg-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={goToNext} className="rounded-lg p-2 hover:bg-zinc-800">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          {view === "day" ? renderDayView() : renderWeekView()}
        </div>
      </div>
    </AdminLayout>
  );
}
