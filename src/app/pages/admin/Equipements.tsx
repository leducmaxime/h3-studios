"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {

  Component,
  Cpu,
  Drum,
  Guitar,
  Headphones,
  Laptop,
  Loader2,
  Mic2,
  Music,
  Package,
  Pencil,
  Piano,
  Plus,
  Radio,
  Save,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_MATERIEL, type MaterielData, type MaterielIconKey, type MaterielItem, type MaterielListItem, type MaterielStudioKey } from "@/lib/materiel";
import { type DbEquipment } from "@/lib/db-types";

interface EquipmentForm {
  equipmentId: string;
  name: string;
  maxPerSession: number;
  pricingType: string;
  sessionPricing: string;
  pricePerHour: number;
}

function parseSessionPricing(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatSessionPrices(prices: number[]): string {
  if (prices.length === 0) return "—";
  return prices.map((p, i) => `${i + 1}× = ${p}€`).join(", ");
}

const INITIAL_EQUIPMENT_FORM: EquipmentForm = {
  equipmentId: "",
  name: "",
  maxPerSession: 1,
  pricingType: "session",
  sessionPricing: "3",
  pricePerHour: 0,
};

const ICONS: Record<MaterielIconKey, React.ElementType> = {
  drum: Drum,
  guitar: Guitar,
  volume2: Volume2,
  mic2: Mic2,
  headphones: Headphones,
  laptop: Laptop,
  music: Music,
  piano: Piano,
  component: Component,
  cpu: Cpu,
  radio: Radio,
};

const ICON_OPTIONS: Array<{ value: MaterielIconKey; label: string }> = [
  { value: "drum", label: "Batterie" },
  { value: "guitar", label: "Guitare" },
  { value: "radio", label: "Amplis" },
  { value: "volume2", label: "Mixage" },
  { value: "headphones", label: "Amplification" },
  { value: "mic2", label: "Micro" },
  { value: "cpu", label: "Numérique" },
  { value: "laptop", label: "Logiciel" },
  { value: "music", label: "Musique" },
  { value: "piano", label: "Clavier" },
  { value: "component", label: "Percussion" },
];

type ListKey = "recording" | "rental";

type EditMode =
  | { kind: "studio-meta"; studioKey: MaterielStudioKey }
  | { kind: "studio-item"; studioKey: MaterielStudioKey; itemId: string | null }
  | { kind: "list-item"; listKey: ListKey; itemId: string | null };

interface DeleteTarget {
  kind: "studio-item" | "list-item";
  studioKey?: MaterielStudioKey;
  listKey?: ListKey;
  itemId: string;
  label: string;
}

function splitLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cloneMateriel(value: MaterielData): MaterielData {
  return JSON.parse(JSON.stringify(value)) as MaterielData;
}

function getStudioLabel(key: MaterielStudioKey): string {
  return key === "laScene" ? "La Scène" : "Le Podium";
}

function getListLabel(key: ListKey): string {
  return key === "recording" ? "Équipement d'enregistrement" : "Location d'instruments";
}

function getItemLabel(item: { category: string }): string {
  return item.category || "(sans catégorie)";
}

function StudioBlock({
  studioKey,
  studio,
  saving,
  onEditStudio,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: {
  studioKey: MaterielStudioKey;
  studio: MaterielData["studios"][MaterielStudioKey];
  saving: boolean;
  onEditStudio: (studioKey: MaterielStudioKey) => void;
  onAddItem: (studioKey: MaterielStudioKey) => void;
  onEditItem: (studioKey: MaterielStudioKey, item: MaterielItem) => void;
  onDeleteItem: (studioKey: MaterielStudioKey, item: MaterielItem) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{studio.name}</h2>
          <p className="text-sm text-zinc-400">{studio.size}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-zinc-700 text-zinc-300">Studio</Badge>
          <Button type="button" size="sm" variant="outline" onClick={() => onEditStudio(studioKey)} disabled={saving}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {studio.items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-200">{item.category}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.equipment}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditItem(studioKey, item)}
                    disabled={saving}
                    className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteItem(studioKey, item)}
                    disabled={saving}
                    className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-300 disabled:opacity-50"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <Button type="button" variant="outline" onClick={() => onAddItem(studioKey)} disabled={saving}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un équipement
        </Button>
      </div>
    </div>
  );
}

function ListSection({
  title,
  description,
  items,
  saving,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  description?: string;
  items: MaterielListItem[];
  saving: boolean;
  onAdd: () => void;
  onEdit: (item: MaterielListItem) => void;
  onDelete: (item: MaterielListItem) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
        </div>
        <Button type="button" variant="outline" onClick={onAdd} disabled={saving}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">{item.category}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    disabled={saving}
                    className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    disabled={saving}
                    className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-300 disabled:opacity-50"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <ul className="space-y-1">
                {item.equipment.map((eq) => (
                  <li key={eq} className="text-xs text-zinc-400">
                    {eq}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OptionsPayantesTab() {
  const [equipment, setEquipment] = useState<DbEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [eqDialogOpen, setEqDialogOpen] = useState(false);
  const [eqSubmitting, setEqSubmitting] = useState(false);
  const [eqForm, setEqForm] = useState<EquipmentForm>(INITIAL_EQUIPMENT_FORM);
  const [editingEqId, setEditingEqId] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DbEquipment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const eqRes = await fetch("/api/admin/equipment");
      if (!eqRes.ok) throw new Error("Failed to fetch equipment");
      const eqJson = await eqRes.json() as { success: boolean; data: DbEquipment[] };
      if (eqJson.success) setEquipment(eqJson.data);
    } catch {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEquipmentCreate = () => {
    setEditingEqId(null);
    setEqForm(INITIAL_EQUIPMENT_FORM);
    setEqDialogOpen(true);
  };

  const openEquipmentEdit = (eq: DbEquipment) => {
    setEditingEqId(eq.id);
    const prices = parseSessionPricing(eq.session_pricing);
    setEqForm({
      equipmentId: eq.equipment_id,
      name: eq.name,
      maxPerSession: eq.max_per_session,
      pricingType: eq.pricing_type,
      sessionPricing: prices.join(", "),
      pricePerHour: eq.price_per_hour,
    });
    setEqDialogOpen(true);
  };

  const handleEquipmentSubmit = async () => {
    if (!eqForm.name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    if (!eqForm.equipmentId.trim()) {
      toast.error("L'identifiant est obligatoire");
      return;
    }
    if (eqForm.maxPerSession < 1) {
      toast.error("La quantité max doit être ≥ 1");
      return;
    }

    const sessionPrices = eqForm.sessionPricing
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));

    if (eqForm.pricingType === "session" && sessionPrices.length === 0) {
      toast.error("Veuillez renseigner au moins un tarif par séance");
      return;
    }

    setEqSubmitting(true);
    try {
      const body = {
        equipment_id: eqForm.equipmentId.trim(),
        name: eqForm.name.trim(),
        max_per_session: eqForm.maxPerSession,
        pricing_type: eqForm.pricingType,
        session_pricing: JSON.stringify(sessionPrices),
        price_per_hour: eqForm.pricePerHour,
      };

      const isEdit = editingEqId !== null;
      const url = isEdit ? `/api/admin/equipment/${editingEqId}` : "/api/admin/equipment";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json() as { success: boolean; error?: string };

      if (json.success) {
        toast.success(isEdit ? "Équipement modifié" : "Équipement ajouté");
        setEqDialogOpen(false);
        setEqForm(INITIAL_EQUIPMENT_FORM);
        setEditingEqId(null);
        fetchData();
      } else {
        toast.error(json.error || "Erreur lors de l'opération");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setEqSubmitting(false);
    }
  };

  const confirmDeleteEquipment = (eq: DbEquipment) => {
    setDeleteTarget(eq);
    setDeleteDialogOpen(true);
  };

  const handleDeleteEquipment = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/equipment/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json() as { success: boolean; error?: string };

      if (json.success) {
        toast.success("Équipement supprimé");
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        fetchData();
      } else {
        toast.error(json.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openEquipmentCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une option
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="border-b border-zinc-800 p-4">
          <h2 className="font-semibold">Options disponibles</h2>
          <p className="text-sm text-zinc-400">Équipements proposés en option lors de la réservation</p>
        </div>

        {equipment.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <Package className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>Aucune option configurée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Identifiant</th>
                  <th className="px-4 py-3 font-medium">Tarification</th>
                  <th className="px-4 py-3 font-medium text-center">Qté max</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {equipment.map((eq) => {
                  const sessionPrices = parseSessionPricing(eq.session_pricing);
                  return (
                    <tr key={eq.id} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Package className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{eq.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{eq.equipment_id}</code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {eq.pricing_type === "session" ? (
                          <div>
                            <Badge variant="secondary" className="mb-1">Par séance</Badge>
                            <p className="text-xs text-zinc-400">{formatSessionPrices(sessionPrices)}</p>
                          </div>
                        ) : (
                          <div>
                            <Badge variant="outline" className="mb-1">Horaire</Badge>
                            <p className="text-xs text-zinc-400">{eq.price_per_hour}€/h</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium">{eq.max_per_session}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEquipmentEdit(eq)} className="text-zinc-400 hover:text-primary">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => confirmDeleteEquipment(eq)} className="text-zinc-400 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={eqDialogOpen} onOpenChange={setEqDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>{editingEqId ? "Modifier l'option" : "Ajouter une option"}</DialogTitle>
            <DialogDescription>
              {editingEqId ? "Modifiez les informations de cette option." : "Ajoutez une nouvelle option disponible à la réservation."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="eqName">Nom</Label>
              <Input id="eqName" type="text" value={eqForm.name} onChange={(e) => setEqForm({ ...eqForm, name: e.target.value })} placeholder="ex: Micro supplémentaire" className="border-zinc-700 bg-zinc-800" />
            </div>

            <div>
              <Label htmlFor="eqId">Identifiant technique</Label>
              <Input id="eqId" type="text" value={eqForm.equipmentId} onChange={(e) => setEqForm({ ...eqForm, equipmentId: e.target.value })} placeholder="ex: mic, guitar, cymbal" className="border-zinc-700 bg-zinc-800" disabled={editingEqId !== null} />
              {editingEqId && <p className="mt-1 text-xs text-zinc-500">L'identifiant ne peut pas être modifié.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="eqMax">Quantité max</Label>
                <Input id="eqMax" type="number" min={1} max={10} value={eqForm.maxPerSession} onChange={(e) => setEqForm({ ...eqForm, maxPerSession: parseInt(e.target.value, 10) || 1 })} className="border-zinc-700 bg-zinc-800" />
              </div>
              <div>
                <Label htmlFor="eqPricingType">Type de tarif</Label>
                <select id="eqPricingType" value={eqForm.pricingType} onChange={(e) => setEqForm({ ...eqForm, pricingType: e.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm">
                  <option value="session">Par séance</option>
                  <option value="hourly">Horaire</option>
                </select>
              </div>
            </div>

            {eqForm.pricingType === "session" ? (
              <div>
                <Label htmlFor="eqSessionPricing">Tarifs par séance (séparés par des virgules)</Label>
                <Input id="eqSessionPricing" type="text" value={eqForm.sessionPricing} onChange={(e) => setEqForm({ ...eqForm, sessionPricing: e.target.value })} placeholder="ex: 3, 5, 6" className="border-zinc-700 bg-zinc-800" />
                <p className="mt-1 text-xs text-zinc-500">Position = quantité. Ex: "3, 5, 6" → 1× = 3€, 2× = 5€, 3× = 6€</p>
              </div>
            ) : (
              <div>
                <Label htmlFor="eqPriceHour">Prix par heure (€)</Label>
                <Input id="eqPriceHour" type="number" min={0} step={0.5} value={eqForm.pricePerHour} onChange={(e) => setEqForm({ ...eqForm, pricePerHour: parseFloat(e.target.value) || 0 })} className="border-zinc-700 bg-zinc-800" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEqDialogOpen(false)} disabled={eqSubmitting}>Annuler</Button>
            <Button onClick={handleEquipmentSubmit} disabled={eqSubmitting}>
              {eqSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editingEqId ? "Modification..." : "Ajout..."}</> : editingEqId ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Supprimer l'option</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <span className="font-semibold text-zinc-200">{deleteTarget?.name}</span> ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteEquipment} disabled={deleting}>
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Suppression...</> : <><Trash2 className="mr-2 h-4 w-4" />Supprimer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminEquipements() {
  const [materiel, setMateriel] = useState<MaterielData>(DEFAULT_MATERIEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [edit, setEdit] = useState<EditMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [studioMetaForm, setStudioMetaForm] = useState<{ name: string; size: string }>({ name: "", size: "" });
  const [itemForm, setItemForm] = useState<{ icon: MaterielIconKey; category: string; equipment: string }>({
    icon: "music",
    category: "",
    equipment: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/materiel");
      const json = (await res.json()) as { success: boolean; data?: MaterielData; error?: string };
      if (json.success && json.data) {
        setMateriel(json.data);
      } else {
        toast.error(json.error || "Impossible de charger le matériel");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(async (next: MaterielData, successMessage: string) => {
    const previous = materiel;
    setMateriel(next);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/materiel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materiel: next }),
      });
      const json = (await res.json()) as { success: boolean; data?: MaterielData; error?: string };
      if (!json.success || !json.data) {
        setMateriel(previous);
        toast.error(json.error || "Échec de l'enregistrement");
        return;
      }
      setMateriel(json.data);
      toast.success(successMessage);
    } catch {
      setMateriel(previous);
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }, [materiel]);

  const isEditOpen = edit !== null;
  const isDeleteOpen = deleteTarget !== null;

  const editTitle = useMemo(() => {
    if (!edit) return "";
    if (edit.kind === "studio-meta") return `Modifier ${getStudioLabel(edit.studioKey)}`;
    if (edit.kind === "studio-item") return edit.itemId ? `Modifier équipement (${getStudioLabel(edit.studioKey)})` : `Ajouter équipement (${getStudioLabel(edit.studioKey)})`;
    return edit.itemId ? `Modifier (${getListLabel(edit.listKey)})` : `Ajouter (${getListLabel(edit.listKey)})`;
  }, [edit]);

  const openEditStudioMeta = (studioKey: MaterielStudioKey) => {
    const s = materiel.studios[studioKey];
    setStudioMetaForm({ name: s.name, size: s.size });
    setEdit({ kind: "studio-meta", studioKey });
  };

  const openAddStudioItem = (studioKey: MaterielStudioKey) => {
    setItemForm({ icon: "music", category: "", equipment: "" });
    setEdit({ kind: "studio-item", studioKey, itemId: null });
  };

  const openEditStudioItem = (studioKey: MaterielStudioKey, item: MaterielItem) => {
    setItemForm({ icon: item.icon, category: item.category, equipment: item.equipment });
    setEdit({ kind: "studio-item", studioKey, itemId: item.id });
  };

  const openAddListItem = (listKey: ListKey) => {
    setItemForm({ icon: "music", category: "", equipment: "" });
    setEdit({ kind: "list-item", listKey, itemId: null });
  };

  const openEditListItem = (listKey: ListKey, item: MaterielListItem) => {
    setItemForm({ icon: item.icon, category: item.category, equipment: item.equipment.join("\n") });
    setEdit({ kind: "list-item", listKey, itemId: item.id });
  };

  const confirmDeleteStudioItem = (studioKey: MaterielStudioKey, item: MaterielItem) => {
    setDeleteTarget({ kind: "studio-item", studioKey, itemId: item.id, label: `${getStudioLabel(studioKey)} · ${getItemLabel(item)}` });
  };

  const confirmDeleteListItem = (listKey: ListKey, item: MaterielListItem) => {
    setDeleteTarget({ kind: "list-item", listKey, itemId: item.id, label: `${getListLabel(listKey)} · ${getItemLabel(item)}` });
  };

  const handleSaveEdit = async () => {
    if (!edit) return;
    if (edit.kind === "studio-meta") {
      const name = studioMetaForm.name.trim();
      const size = studioMetaForm.size.trim();
      if (!name || !size) {
        toast.error("Nom et taille sont obligatoires");
        return;
      }

      const next = cloneMateriel(materiel);
      next.studios[edit.studioKey].name = name;
      next.studios[edit.studioKey].size = size;
      setEdit(null);
      await persist(next, "Studio mis à jour");
      return;
    }

    const icon = itemForm.icon;
    const category = itemForm.category.trim();
    const equipmentRaw = itemForm.equipment;

    if (!category) {
      toast.error("La catégorie est obligatoire");
      return;
    }

    if (edit.kind === "studio-item") {
      const equipment = equipmentRaw.trim();
      if (!equipment) {
        toast.error("Le champ équipement est obligatoire");
        return;
      }

      const next = cloneMateriel(materiel);
      if (edit.itemId) {
        const items = next.studios[edit.studioKey].items;
        const idx = items.findIndex((i) => i.id === edit.itemId);
        if (idx < 0) {
          toast.error("Équipement introuvable");
          return;
        }
        items[idx] = { ...items[idx], icon, category, equipment };
      } else {
        next.studios[edit.studioKey].items.push({
          id: crypto.randomUUID(),
          icon,
          category,
          equipment,
        });
      }

      setEdit(null);
      await persist(next, "Équipement studio enregistré");
      return;
    }

    const list = splitLines(equipmentRaw);
    if (list.length === 0) {
      toast.error("Ajoutez au moins une ligne d'équipement");
      return;
    }

    const next = cloneMateriel(materiel);
    const arr = next[edit.listKey];
    if (edit.itemId) {
      const idx = arr.findIndex((i) => i.id === edit.itemId);
      if (idx < 0) {
        toast.error("Équipement introuvable");
        return;
      }
      arr[idx] = { ...arr[idx], icon, category, equipment: list };
    } else {
      arr.push({ id: crypto.randomUUID(), icon, category, equipment: list });
    }

    setEdit(null);
    await persist(next, "Liste enregistrée");
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const next = cloneMateriel(materiel);
    if (deleteTarget.kind === "studio-item") {
      const studioKey = deleteTarget.studioKey!;
      next.studios[studioKey].items = next.studios[studioKey].items.filter((i) => i.id !== deleteTarget.itemId);
    } else {
      const listKey = deleteTarget.listKey!;
      next[listKey] = next[listKey].filter((i) => i.id !== deleteTarget.itemId);
    }
    setDeleteTarget(null);
    await persist(next, "Équipement supprimé");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Équipements</h1>
          <p className="text-zinc-400">
            Gérez le matériel affiché et les options payantes
          </p>
        </div>
      </div>

      <Tabs defaultValue="materiel" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="materiel">Matériel des studios</TabsTrigger>
          <TabsTrigger value="options">Options payantes</TabsTrigger>
        </TabsList>

        <TabsContent value="materiel" className="space-y-6 mt-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <StudioBlock
                  studioKey="laScene"
                  studio={materiel.studios.laScene}
                  saving={saving}
                  onEditStudio={openEditStudioMeta}
                  onAddItem={openAddStudioItem}
                  onEditItem={openEditStudioItem}
                  onDeleteItem={confirmDeleteStudioItem}
                />
                <StudioBlock
                  studioKey="lePodium"
                  studio={materiel.studios.lePodium}
                  saving={saving}
                  onEditStudio={openEditStudioMeta}
                  onAddItem={openAddStudioItem}
                  onEditItem={openEditStudioItem}
                  onDeleteItem={confirmDeleteStudioItem}
                />
              </div>

              <ListSection
                title="Équipement d'enregistrement"
                items={materiel.recording}
                saving={saving}
                onAdd={() => openAddListItem("recording")}
                onEdit={(item) => openEditListItem("recording", item)}
                onDelete={(item) => confirmDeleteListItem("recording", item)}
              />

              <ListSection
                title="Location d'instruments"
                description="Disponibles sur demande lors de votre réservation"
                items={materiel.rental}
                saving={saving}
                onAdd={() => openAddListItem("rental")}
                onEdit={(item) => openEditListItem("rental", item)}
                onDelete={(item) => confirmDeleteListItem("rental", item)}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="options" className="mt-6">
          <OptionsPayantesTab />
        </TabsContent>
      </Tabs>

      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) setEdit(null); }}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>{editTitle}</DialogTitle>
            <DialogDescription>
              Les changements sont enregistrés et reflétés sur le site public.
            </DialogDescription>
          </DialogHeader>

          {edit?.kind === "studio-meta" ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="studioName">Nom</Label>
                <Input
                  id="studioName"
                  value={studioMetaForm.name}
                  onChange={(e) => setStudioMetaForm((s) => ({ ...s, name: e.target.value }))}
                  className="border-zinc-700 bg-zinc-800"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="studioSize">Taille</Label>
                <Input
                  id="studioSize"
                  value={studioMetaForm.size}
                  onChange={(e) => setStudioMetaForm((s) => ({ ...s, size: e.target.value }))}
                  className="border-zinc-700 bg-zinc-800"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Icône</Label>
                <Select value={itemForm.icon} onValueChange={(v) => setItemForm((s) => ({ ...s, icon: v as MaterielIconKey }))}>
                  <SelectTrigger className="border-zinc-700 bg-zinc-800">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900">
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="itemCategory">Catégorie</Label>
                <Input
                  id="itemCategory"
                  value={itemForm.category}
                  onChange={(e) => setItemForm((s) => ({ ...s, category: e.target.value }))}
                  className="border-zinc-700 bg-zinc-800"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="itemEquipment">Équipement</Label>
                <textarea
                  id="itemEquipment"
                  value={itemForm.equipment}
                  onChange={(e) => setItemForm((s) => ({ ...s, equipment: e.target.value }))}
                  rows={edit?.kind === "studio-item" ? 4 : 7}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
                  placeholder={edit?.kind === "studio-item" ? "Texte" : "Une ligne par élément"}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEdit(null)} disabled={saving}>
              <X className="mr-2 h-4 w-4" />
              Annuler
            </Button>
            <Button type="button" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Supprimer</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `Supprimer "${deleteTarget.label}" ?` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
