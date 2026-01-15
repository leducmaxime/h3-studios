"use client";

import { useState, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  CreditCard,
  Building2,
  Settings,
  Menu,
  X,
  ChevronRight,
  LogOut,
  RotateCcw,
} from "lucide-react";
import { resetAdminStore } from "@/lib/admin-store";

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

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/admin/calendar", label: "Calendrier", icon: Calendar },
  { href: "/admin/bookings", label: "Réservations", icon: ClipboardList },
  { href: "/admin/users", label: "Clients", icon: Users },
  { href: "/admin/payments", label: "Paiements", icon: CreditCard },
  { href: "/admin/studios", label: "Studios", icon: Building2 },
  { href: "/admin/settings", label: "Paramètres", icon: Settings },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentPath = usePathname();

  const handleReset = () => {
    if (confirm("Réinitialiser toutes les données de démonstration ?")) {
      resetAdminStore();
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
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
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 hover:bg-zinc-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
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

        <div className="border-t border-zinc-800 p-4">
          <button
            onClick={handleReset}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <RotateCcw className="h-5 w-5" />
            Réinitialiser démo
          </button>
          <a
            href="/"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <LogOut className="h-5 w-5" />
            Retour au site
          </a>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-zinc-800 bg-zinc-900/50 px-4 backdrop-blur lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-zinc-800 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-zinc-500">
            Démo Admin H3 Studios
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
