"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  CreditCard,
  Package,
  Euro,
  Settings,
  FileText,
  Menu,
  X,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Ban,
} from "lucide-react";

import { Toaster } from "@/components/ui/sonner";

function usePathname() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener("popstate", callback);
      const originalPushState = history.pushState.bind(history);
      const originalReplaceState = history.replaceState.bind(history);
      history.pushState = (...args) => { originalPushState(...args); callback(); };
      history.replaceState = (...args) => { originalReplaceState(...args); callback(); };
      return () => {
        window.removeEventListener("popstate", callback);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
      };
    },
    () => window.location.pathname,
    () => "/admin"
  );
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "super-admin" | "operator";
}

interface AdminLayoutProps {
  children?: React.ReactNode;
}

const ALL_NAV_ITEMS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true, superAdminOnly: false },
  { href: "/admin/calendar", label: "Calendrier", icon: Calendar, superAdminOnly: false },
  { href: "/admin/bookings", label: "Réservations", icon: ClipboardList, superAdminOnly: false },
  { href: "/admin/blocked-slots", label: "Blocages d'agenda", icon: Ban, superAdminOnly: false },
  { href: "/admin/users", label: "Clients", icon: Users, superAdminOnly: false },
  { href: "/admin/payments", label: "Paiements", icon: CreditCard, superAdminOnly: false },
  { href: "/admin/equipements", label: "Équipements", icon: Package, superAdminOnly: true },
  { href: "/admin/pricing", label: "Tarifs", icon: Euro, superAdminOnly: true },
  { href: "/admin/settings", label: "Paramètres", icon: Settings, superAdminOnly: true },
  { href: "/admin/audit-log", label: "Journal d'audit", icon: FileText, superAdminOnly: true },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const currentPath = usePathname();

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json() as Promise<{ success: boolean; data?: AdminUser }>)
      .then((data) => {
        if (data.success && data.data) setUser(data.data);
      })
      .catch(console.error);
  }, []);

  const navItems = ALL_NAV_ITEMS;

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.href = "/admin/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <button
        type="button"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Fermer le menu"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-zinc-900 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
          <a href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-blanka text-sm text-black">
              H3
            </div>
            <span className="font-blanka text-lg">ADMIN</span>
          </a>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 hover:bg-zinc-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {user && (
          <div className="border-b border-zinc-800 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <span className="font-semibold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{user.name}</p>
                <p className="text-xs text-zinc-400">
                  {user.role === "super-admin" ? "Super Admin" : "Opérateur"}
                </p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? currentPath === item.href
                : currentPath.startsWith(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-1 border-t border-zinc-800 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <LogOut className="h-5 w-5" />
            Déconnexion
          </button>
          <a
            href="/"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <ArrowLeft className="h-5 w-5" />
            Retour au site
          </a>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-zinc-800 bg-zinc-900/50 px-4 backdrop-blur lg:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-zinc-800 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          {user && (
            <span className="text-sm text-zinc-500">
              {user.name} — {user.role === "super-admin" ? "Super Admin" : "Opérateur"}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
