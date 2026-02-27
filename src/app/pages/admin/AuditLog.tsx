"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  User,
  CreditCard,
  Box,
  Shield,
  Calendar,
  Clock,
  Eye,
  Loader2,
  Filter,
  X,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ApiAuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: string | null;
  performed_by: string;
  admin_name?: string | null;
  created_at: string;
}

interface AuditLogsResponse {
  success: boolean;
  data: {
    data: ApiAuditLog[];
    total: number;
    page: number;
    limit: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ENTITY_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  booking: { label: "Réservation", icon: Calendar, color: "text-blue-400" },
  user: { label: "Client", icon: User, color: "text-emerald-400" },
  payment: { label: "Paiement", icon: CreditCard, color: "text-amber-400" },
  setting: { label: "Paramètre", icon: Shield, color: "text-purple-400" },
  promo: { label: "Code promo", icon: FileText, color: "text-pink-400" },
  equipment: { label: "Équipement", icon: Box, color: "text-cyan-400" },
  pricing: { label: "Tarif", icon: FileText, color: "text-orange-400" },
  blocked_slot: { label: "Créneau bloqué", icon: Clock, color: "text-red-400" },
  opening_hours: { label: "Horaires", icon: Clock, color: "text-teal-400" },
};

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "Création", variant: "default" },
  update: { label: "Modification", variant: "secondary" },
  delete: { label: "Suppression", variant: "destructive" },
  cancel: { label: "Annulation", variant: "destructive" },
  "no-show": { label: "No-show", variant: "destructive" },
  "mark-paid": { label: "Payé", variant: "default" },
  refund: { label: "Remboursement", variant: "destructive" },
  block: { label: "Blocage", variant: "destructive" },
  unblock: { label: "Déblocage", variant: "default" },
  merge: { label: "Fusion", variant: "secondary" },
  reschedule: { label: "Replanification", variant: "secondary" },
  "batch-update": { label: "Mise à jour groupée", variant: "secondary" },
};

function getEntityConfig(entityType: string) {
  return ENTITY_CONFIG[entityType] || { label: entityType, icon: FileText, color: "text-zinc-400" };
}

function getActionConfig(action: string) {
  return ACTION_LABELS[action] || { label: action, variant: "outline" as const };
}

function parseChanges(changesStr: string | null): unknown {
  if (!changesStr) return null;
  try {
    return JSON.parse(changesStr);
  } catch {
    return changesStr;
  }
}

function formatJsonPretty(data: unknown): string {
  if (data === null || data === undefined) return "Aucun détail";
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}

function formatChangesPreview(changes: unknown, entityType?: string): string {
  if (changes === null || changes === undefined) return "—";
  if (typeof changes === "string") return changes.slice(0, 60);
  if (typeof changes === "object" && changes !== null) {
    const obj = changes as Record<string, unknown>;
    
    // Booking-specific formatting
    if (entityType === "booking") {
      if (obj.booking_ref && obj.studio_id) {
        const studio = obj.studio_id === "la-scene" ? "La Scène" : obj.studio_id === "le-podium" ? "Le Podium" : obj.studio_id;
        return `${obj.booking_ref} - ${studio}`;
      }
      if (obj.date && obj.start_time) {
        return `${obj.date} à ${obj.start_time}`;
      }
      if (obj.status) return `Statut: ${obj.status}`;
    }
    
    // User-specific formatting
    if (entityType === "user") {
      if (obj.name) return `Nom: ${obj.name}`;
      if (obj.band_name) return `Groupe: ${obj.band_name}`;
      if (obj.email) return `Email: ${obj.email}`;
    }
    
    // Payment-specific formatting
    if (entityType === "payment" || entityType === "payments") {
      if (obj.amount) return `Montant: ${Number(obj.amount) / 100}€`;
    }
    
    // Setting-specific formatting
    if (entityType === "setting") {
      if (obj.key && obj.value !== undefined) return `${obj.key}: ${obj.value}`;
      if (obj.key) return obj.key as string;
    }
    
    // Promo-specific formatting
    if (entityType === "promo") {
      if (obj.code) return `Code: ${obj.code}`;
    }
    
    // Generic fallback with readable labels
    const labels: Record<string, string> = {
      status: "Statut", payment_status: "Paiement", price: "Prix",
      name: "Nom", email: "Email", phone: "Tél", reason: "Raison",
      blocked: "Bloqué", is_active: "Actif", role: "Rôle"
    };
    
    const entries = Object.entries(obj).slice(0, 2);
    if (entries.length > 0) {
      return entries.map(([k, v]) => {
        const label = labels[k] || k;
        const val = String(v).slice(0, 20);
        return `${label}: ${val}`;
      }).join(", ");
    }
  }
  return "—";
}
// ─── Detail Dialog ──────────────────────────────────────────────────────────────

function AuditDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: ApiAuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;

  const entityCfg = getEntityConfig(log.entity_type);
  const actionCfg = getActionConfig(log.action);
  const changes = parseChanges(log.changes);
  const EntityIcon = entityCfg.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EntityIcon className={`h-5 w-5 ${entityCfg.color}`} />
            Détail de l&apos;action
          </DialogTitle>
          <DialogDescription>
            {actionCfg.label} sur {entityCfg.label.toLowerCase()} — {formatDateTime(log.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-1 text-xs text-zinc-500">Entité</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-zinc-700">
                  {entityCfg.label}
                </Badge>
                <span className="font-mono text-xs text-zinc-400">{log.entity_id}</span>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-1 text-xs text-zinc-500">Action</p>
              <Badge variant={actionCfg.variant}>{actionCfg.label}</Badge>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-1 text-xs text-zinc-500">Réalisé par</p>
              <p className="font-medium text-zinc-200">{log.performed_by}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-1 text-xs text-zinc-500">Date</p>
              <p className="font-medium text-zinc-200">{formatDateTime(log.created_at)}</p>
            </div>
          </div>

          {/* Changes JSON */}
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-300">Changements</p>
            <div className="max-h-72 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-300">
                {formatJsonPretty(changes)}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AdminAuditLog() {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 30;

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<ApiAuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // New filter states
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [admins, setAdmins] = useState<Array<{ id: string; name: string }>>([]);
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(perPage));
      if (entityTypeFilter !== "all") params.set("entity_type", entityTypeFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (adminFilter !== "all") params.set("admin_id", adminFilter);
      if (dateFrom) params.set("from_date", dateFrom);
      if (dateTo) params.set("to_date", dateTo);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      const json = (await res.json()) as AuditLogsResponse;
      if (json.success) {
        setLogs(json.data.data);
        setTotal(json.data.total);
        // Extract unique admins with names from the logs
        const adminMap = new Map<string, string>();
        for (const log of json.data.data) {
          if (!adminMap.has(log.performed_by)) {
            adminMap.set(log.performed_by, log.admin_name || log.performed_by);
          }
        }
        const adminList = Array.from(adminMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setAdmins(adminList);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      toast.error("Erreur lors du chargement des logs");
    } finally {
      setLoading(false);
    }
  }, [page, entityTypeFilter, actionFilter, adminFilter, dateFrom, dateTo, sortBy, sortOrder]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [entityTypeFilter, actionFilter, adminFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // Client-side search on entity_id, action, performed_by
  const filteredLogs = searchQuery
    ? logs.filter((log) => {
        const q = searchQuery.toLowerCase();
        return (
          log.entity_id.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.performed_by.toLowerCase().includes(q) ||
          log.entity_type.toLowerCase().includes(q) ||
          (log.changes && log.changes.toLowerCase().includes(q))
        );
      })
    : logs;

  const totalPages = Math.ceil(total / perPage);
  const hasActiveFilters =
    entityTypeFilter !== "all" ||
    actionFilter !== "all" ||
    adminFilter !== "all" ||
    dateFrom ||
    dateTo;

  function clearFilters() {
    setEntityTypeFilter("all");
    setActionFilter("all");
    setAdminFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    setSortBy("date");
    setSortOrder("desc");
    setPage(1);
  }

  function openDetail(log: ApiAuditLog) {
    setSelectedLog(log);
    setDetailOpen(true);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal d&apos;audit</h1>
          <p className="text-zinc-400">
            {total} entrée(s) — Historique complet des actions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersVisible(!filtersVisible)}
          className="border-zinc-700"
        >
          <Filter className="mr-2 h-4 w-4" />
          Filtres
          {hasActiveFilters && (
            <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-black">
              !
            </span>
          )}
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        {/* Search bar — always visible */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Rechercher par ID, action, utilisateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-zinc-700 bg-zinc-900 pl-10"
          />
        </div>

        {/* Collapsible filters */}
        {filtersVisible && (
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="entity-filter" className="text-xs text-zinc-400">Type d&apos;entité</label>
              <select
                id="entity-filter"
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">Tous les types</option>
                <option value="booking">Réservation</option>
                <option value="user">Client</option>
                <option value="payment">Paiement</option>
                <option value="setting">Paramètre</option>
                <option value="promo">Code promo</option>
                <option value="equipment">Équipement</option>
                <option value="pricing">Tarif</option>
                <option value="blocked_slot">Créneau bloqué</option>
                <option value="opening_hours">Horaires</option>
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label htmlFor="action-filter" className="text-xs text-zinc-400">Action</label>
              <select
                id="action-filter"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">Toutes les actions</option>
                <option value="create">Création</option>
                <option value="update">Modification</option>
                <option value="delete">Suppression</option>
                <option value="cancel">Annulation</option>
                <option value="no-show">No-show</option>
                <option value="mark-paid">Payé</option>
                <option value="refund">Remboursement</option>
                <option value="block">Blocage</option>
                <option value="unblock">Déblocage</option>
                <option value="merge">Fusion</option>
                <option value="reschedule">Replanification</option>
                <option value="batch-update">Mise à jour groupée</option>
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label htmlFor="admin-filter" className="text-xs text-zinc-400">Administrateur</label>
              <select
                id="admin-filter"
                value={adminFilter}
                onChange={(e) => setAdminFilter(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">Tous les admins</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label htmlFor="date-from" className="text-xs text-zinc-400">Du</label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-zinc-700 bg-zinc-800"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label htmlFor="date-to" className="text-xs text-zinc-400">Au</label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border-zinc-700 bg-zinc-800"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="shrink-0 text-zinc-400 hover:text-white"
              >
                <X className="mr-1 h-4 w-4" />
                Effacer
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-zinc-800 bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  <button
                    onClick={() => {
                      if (sortBy === "date") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("date");
                        setSortOrder("desc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    Date {sortBy === "date" ? (sortOrder === "asc" ? "↑" : "↓") : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  <button
                    onClick={() => {
                      if (sortBy === "admin") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("admin");
                        setSortOrder("asc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    Utilisateur {sortBy === "admin" ? (sortOrder === "asc" ? "↑" : "↓") : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  <button
                    onClick={() => {
                      if (sortBy === "action") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy("action");
                        setSortOrder("asc");
                      }
                    }}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    Action {sortBy === "action" ? (sortOrder === "asc" ? "↑" : "↓") : <ArrowUpDown className="h-3 w-3" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Entité
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">
                  Détails
                </th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredLogs.map((log) => {
                const entityCfg = getEntityConfig(log.entity_type);
                const actionCfg = getActionConfig(log.action);
                const EntityIcon = entityCfg.icon;
                const changes = parseChanges(log.changes);
                const changesPreview = formatChangesPreview(changes, log.entity_type);
                return (
                  <tr
                    key={log.id}
                    className="group cursor-pointer bg-zinc-900/50 transition-colors hover:bg-zinc-800/50"
                    onClick={() => openDetail(log)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{formatDateShort(log.created_at)}</p>
                        <p className="text-xs text-zinc-500">{formatTime(log.created_at)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-300">{log.performed_by}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={actionCfg.variant}>{actionCfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <EntityIcon className={`h-4 w-4 ${entityCfg.color}`} />
                        <div>
                          <p className="text-sm">{entityCfg.label}</p>
                          <p className="font-mono text-xs text-zinc-500">{log.entity_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p className="truncate font-mono text-xs text-zinc-500">
                        {changesPreview}{changesPreview.length >= 60 ? "…" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(log);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Voir détails</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    <FileText className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                    <p>Aucune entrée trouvée</p>
                    {hasActiveFilters && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={clearFilters}
                        className="mt-2 text-primary"
                      >
                        Réinitialiser les filtres
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            Page {page} sur {totalPages} — {total} entrée(s)
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

      {/* Detail Dialog */}
      <AuditDetailDialog
        log={selectedLog}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
