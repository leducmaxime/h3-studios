"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  User,
  Ban,
  Merge,
  Eye,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/booking";
import { type DbUser } from "@/lib/db-types";
import { exportUsersCSV } from "@/lib/export";

interface UsersApiResponse {
  data: DbUser[];
  total: number;
  page: number;
  limit: number;
}

export function AdminUsers() {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [blockedFilter, setBlockedFilter] = useState<"all" | "blocked" | "active">("all");
  const [sortBy, setSortBy] = useState<"created_at" | "name" | "total_bookings" | "total_spent">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [primaryUserId, setPrimaryUserId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
    band_name: "",
  });
  const perPage = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
      });
      if (search) params.set("search", search);

      if (blockedFilter !== "all") params.set("blocked", blockedFilter === "blocked" ? "true" : "false");
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/admin/users?${params}`);
      const json = (await res.json()) as { success: boolean; data: UsersApiResponse };
      if (json.success) {
        setUsers(json.data.data);
        setTotal(json.data.total);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Erreur lors du chargement des clients");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, blockedFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(total / perPage);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBlock = async (userId: string, blocked: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(blocked ? "Client bloqué" : "Client débloqué");
        fetchUsers();
      } else {
        toast.error(json.error || "Erreur");
      }
    } catch (error) {
      console.error("Block error:", error);
      toast.error("Erreur lors du blocage");
    }
  };

  const handleMerge = async () => {
    if (!primaryUserId || selectedIds.size < 2) return;
    setMerging(true);

    try {
      const duplicateIds = Array.from(selectedIds).filter((id) => id !== primaryUserId);

      for (const sourceId of duplicateIds) {
        const res = await fetch("/api/admin/users/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId, targetId: primaryUserId }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) {
          toast.error(json.error || "Erreur lors de la fusion");
          return;
        }
      }

      toast.success(`${duplicateIds.length} compte(s) fusionné(s)`);
      setSelectedIds(new Set());
      setShowMergeDialog(false);
      setPrimaryUserId(null);
      fetchUsers();
    } catch (error) {
      console.error("Merge error:", error);
      toast.error("Erreur lors de la fusion");
    } finally {
      setMerging(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setCreating(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
          band_name: createForm.band_name.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: DbUser; error?: string };
      if (json.success) {
        toast.success(`Client "${createForm.name}" créé`);
        setCreateForm({ name: "", email: "", phone: "", band_name: "" });
        setShowCreateDialog(false);
        fetchUsers();
      } else {
        toast.error(json.error || "Erreur lors de la création");
      }
    } catch (error) {
      console.error("Create error:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const selectedUsers = useMemo(() => {
    return users.filter((u) => selectedIds.has(u.id));
  }, [users, selectedIds]);

  const handleExportCSV = () => {
    exportUsersCSV(users);
    toast.success(`${users.length} client(s) exporté(s)`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-zinc-400">{total} client(s)</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            Exporter CSV
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Nouveau client
              </Button>
            </DialogTrigger>
          <DialogContent className="border-zinc-800 bg-zinc-900">
            <DialogHeader>
              <DialogTitle>Nouveau client</DialogTitle>
              <DialogDescription>
                Créer un nouveau client rapidement. Seul le nom est obligatoire.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="create-name">Nom *</Label>
                <Input
                  id="create-name"
                  placeholder="Jean Dupont"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="jean@exemple.fr"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-phone">Téléphone</Label>
                  <Input
                    id="create-phone"
                    type="tel"
                    placeholder="06 12 34 56 78"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-band">Groupe / Artiste</Label>
                  <Input
                    id="create-band"
                    placeholder="Les Rockers"
                    value={createForm.band_name}
                    onChange={(e) => setCreateForm({ ...createForm, band_name: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={creating}
              >
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={creating || !createForm.name.trim()}>
                {creating ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            id="user-search"
            placeholder="Rechercher par nom, email, téléphone ou groupe..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 border-zinc-700 bg-zinc-800"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={blockedFilter}
            onChange={(e) => { setBlockedFilter(e.target.value as typeof blockedFilter); setPage(1); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="all">Tous les clients</option>
            <option value="active">Actifs</option>
            <option value="blocked">Bloqués</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="created_at">Trier par création</option>
            <option value="name">Trier par nom</option>
            <option value="total_bookings">Trier par réservations</option>
            <option value="total_spent">Trier par total dépensé</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value as typeof sortOrder); setPage(1); }}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </select>
        </div>
      </div>

      {/* Merge selection bar */}
      {selectedIds.size >= 2 && (
        <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>

          <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
                <Merge className="h-4 w-4" />
                Fusionner
              </Button>
            </DialogTrigger>
            <DialogContent className="border-zinc-800 bg-zinc-900">
              <DialogHeader>
                <DialogTitle>Fusionner les utilisateurs</DialogTitle>
                <DialogDescription>
                  Sélectionnez le compte principal. Les réservations des autres comptes seront transférées vers ce compte.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                {selectedUsers.map((user) => (
                  <label
                    key={user.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      primaryUserId === user.id
                        ? "border-primary bg-primary/10"
                        : "border-zinc-700 hover:border-zinc-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="primary"
                      checked={primaryUserId === user.id}
                      onChange={() => setPrimaryUserId(user.id)}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-zinc-400">{user.email || "Pas d'email"}</p>
                      {user.band_name && (
                        <p className="text-sm text-zinc-500">{user.band_name}</p>
                      )}
                    </div>
                    <span className="text-sm text-zinc-500">
                      {user.total_bookings} résa.
                    </span>
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMergeDialog(false);
                    setPrimaryUserId(null);
                  }}
                  disabled={merging}
                >
                  Annuler
                </Button>
                <Button onClick={handleMerge} disabled={!primaryUserId || merging}>
                  {merging ? "Fusion..." : "Fusionner"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-zinc-400 hover:text-white"
          >
            Désélectionner
          </Button>
        </div>
      )}

      {/* Table */}
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="bg-zinc-900/50 transition-colors hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="rounded border-zinc-600 accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/admin/users/${user.id}`} className="flex items-center gap-3 hover:underline">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.name}</p>
                          {user.is_blocked === 1 && (
                            <Badge variant="destructive" className="text-[10px]">
                              Bloqué
                            </Badge>
                          )}
                        </div>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p>{user.email || "—"}</p>
                      <p className="text-zinc-400">{user.phone || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{user.band_name || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm">{user.total_bookings}</td>
                    <td className="px-4 py-3 text-right font-medium text-primary">
                      {formatPrice(user.total_spent)}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-900">
                          <DropdownMenuItem asChild>
                            <a href={`/admin/users/${user.id}`} className="cursor-pointer gap-2">
                              <Eye className="h-4 w-4" />
                              Voir le profil
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleBlock(user.id, user.is_blocked !== 1)}
                            variant={user.is_blocked === 1 ? "default" : "destructive"}
                            className="cursor-pointer gap-2"
                          >
                            <Ban className="h-4 w-4" />
                            {user.is_blocked === 1 ? "Débloquer" : "Bloquer"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            Page {page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
