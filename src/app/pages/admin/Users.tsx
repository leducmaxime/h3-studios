"use client";

import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  User,
  Ban,
  Merge,
  Check,
  X,
} from "lucide-react";
import {
  loadAdminStore,
  blockUser,
  mergeUsers,
  saveAdminStore,
  type AdminStore,
  type AdminUser,
} from "@/lib/admin-store";
import { formatPrice } from "@/lib/booking";

export function AdminUsers() {
  const [store, setStore] = useState<AdminStore | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [primaryUserId, setPrimaryUserId] = useState<string | null>(null);
  const perPage = 20;

  useEffect(() => {
    setStore(loadAdminStore());
  }, []);

  const filteredUsers = useMemo(() => {
    if (!store) return [];

    return store.users
      .filter((u) => {
        if (u.email.includes("_merged_")) return false;
        if (search) {
          const searchLower = search.toLowerCase();
          return (
            u.name.toLowerCase().includes(searchLower) ||
            u.email.toLowerCase().includes(searchLower) ||
            u.phone.includes(search) ||
            u.bandName.toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .sort((a, b) => b.totalBookings - a.totalBookings);
  }, [store, search]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredUsers.slice(start, start + perPage);
  }, [filteredUsers, page]);

  const totalPages = Math.ceil(filteredUsers.length / perPage);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBlock = (userId: string, blocked: boolean) => {
    if (!store) return;
    blockUser(store, userId, blocked);
    setStore({ ...store });
  };

  const handleMerge = () => {
    if (!store || !primaryUserId || selectedIds.size < 2) return;

    const duplicateIds = Array.from(selectedIds).filter((id) => id !== primaryUserId);
    mergeUsers(store, primaryUserId, duplicateIds);
    setStore({ ...store });
    setSelectedIds(new Set());
    setShowMergeModal(false);
    setPrimaryUserId(null);
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

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clients</h1>
            <p className="text-zinc-400">{filteredUsers.length} client(s)</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              id="user-search"
              type="text"
              placeholder="Rechercher par nom, email, téléphone ou groupe..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {selectedIds.size >= 2 && (
          <div className="flex items-center gap-4 rounded-lg bg-primary/10 px-4 py-3">
            <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
            <button
              onClick={() => setShowMergeModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary/20 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/30"
            >
              <Merge className="h-4 w-4" />
              Fusionner
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto rounded-lg p-1.5 hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="border-b border-zinc-800 bg-zinc-900">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Sélectionner</span>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Contact</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Groupe</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Réservations</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-400">Total dépensé</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="bg-zinc-900/50 hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="rounded border-zinc-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/admin/users/${user.id}`} className="flex items-center gap-3 hover:underline">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          {user.isBlocked && (
                            <span className="text-xs text-red-400">Bloqué</span>
                          )}
                        </div>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p>{user.email}</p>
                      <p className="text-zinc-400">{user.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{user.bandName || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm">{user.totalBookings}</td>
                    <td className="px-4 py-3 text-right font-medium text-primary">
                      {formatPrice(user.totalSpent)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <a
                          href={`/admin/users/${user.id}`}
                          className="rounded-lg p-1.5 hover:bg-zinc-700"
                          title="Voir"
                        >
                          <User className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => handleBlock(user.id, !user.isBlocked)}
                          className={`rounded-lg p-1.5 ${user.isBlocked ? "text-green-400 hover:bg-green-500/20" : "text-red-400 hover:bg-red-500/20"}`}
                          title={user.isBlocked ? "Débloquer" : "Bloquer"}
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Page {page} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showMergeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 text-lg font-semibold">Fusionner les utilisateurs</h3>
              <p className="mb-4 text-sm text-zinc-400">
                Sélectionnez le compte principal. Les réservations des autres comptes seront transférées vers ce compte.
              </p>
              <div className="mb-4 space-y-2">
                {Array.from(selectedIds).map((id) => {
                  const user = store.users.find((u) => u.id === id);
                  if (!user) return null;
                  return (
                    <label
                      key={id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                        primaryUserId === id ? "border-primary bg-primary/10" : "border-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="primary"
                        checked={primaryUserId === id}
                        onChange={() => setPrimaryUserId(id)}
                        className="accent-primary"
                      />
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-zinc-400">{user.email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleMerge}
                  disabled={!primaryUserId}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-black hover:bg-primary/90 disabled:opacity-50"
                >
                  Fusionner
                </button>
                <button
                  onClick={() => { setShowMergeModal(false); setPrimaryUserId(null); }}
                  className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
