"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_RESERVATION_BANNER,
  RESERVATION_BANNER_DESCRIPTION_MAX_LENGTH,
  RESERVATION_BANNER_GROUP_KEYS,
  RESERVATION_BANNER_GROUP_LABELS,
  RESERVATION_BANNER_TITLE_MAX_LENGTH,
  reservationBannerSettingKey,
  type ReservationBannerGroupKey,
} from "@/lib/reservation-banner";

async function saveSetting(key: string, value: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    if (!json.success) {
      toast.error(json.error || "Erreur lors de la sauvegarde");
      return false;
    }
    return true;
  } catch {
    toast.error("Erreur réseau");
    return false;
  }
}

function CharacterCount({ length, max }: { length: number; max: number }) {
  const over = length > max;
  return (
    <span
      className={`text-xs tabular-nums ${over ? "font-medium text-red-400" : "text-zinc-500"}`}
    >
      {length} / {max}
    </span>
  );
}

function BannerGroupCard({
  group,
  settings,
  onUpdate,
}: {
  group: ReservationBannerGroupKey;
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}) {
  const titleKey = reservationBannerSettingKey(group, "title");
  const descriptionKey = reservationBannerSettingKey(group, "description");

  const savedTitle = settings[titleKey] ?? "";
  const savedDescription = settings[descriptionKey] ?? "";

  const [title, setTitle] = useState(savedTitle);
  const [description, setDescription] = useState(savedDescription);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setTitle(savedTitle);
    setDescription(savedDescription);
  }, [savedTitle, savedDescription]);

  const defaults = DEFAULT_RESERVATION_BANNER[group];
  const previewTitle = title.trim() || defaults.title;
  const previewDescription = description.trim() || defaults.description;

  const titleTooLong = title.trim().length > RESERVATION_BANNER_TITLE_MAX_LENGTH;
  const descriptionTooLong =
    description.trim().length > RESERVATION_BANNER_DESCRIPTION_MAX_LENGTH;
  const unchanged =
    title.trim() === savedTitle.trim() &&
    description.trim() === savedDescription.trim();

  const isSaving = saving !== null;

  const persist = async () => {
    setSaving(group);
    const nextTitle = title.trim();
    const nextDescription = description.trim();

    if (nextTitle !== savedTitle.trim()) {
      const ok = await saveSetting(titleKey, nextTitle);
      if (!ok) {
        setSaving(null);
        return;
      }
      onUpdate(titleKey, nextTitle);
    }

    if (nextDescription !== savedDescription.trim()) {
      const ok = await saveSetting(descriptionKey, nextDescription);
      if (!ok) {
        setSaving(null);
        return;
      }
      onUpdate(descriptionKey, nextDescription);
    }

    setSaving(null);
    toast.success("Paramètre enregistré");
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BadgePercent className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">
            {RESERVATION_BANNER_GROUP_LABELS[group]}
          </h3>
          <p className="text-xs text-zinc-500">
            Texte affiché quand le client choisit ce type de groupe
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={titleKey} className="text-xs text-zinc-400">
              Titre
            </Label>
            <CharacterCount
              length={title.trim().length}
              max={RESERVATION_BANNER_TITLE_MAX_LENGTH}
            />
          </div>
          <Input
            id={titleKey}
            value={title}
            placeholder={defaults.title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-zinc-700 bg-zinc-800"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={descriptionKey} className="text-xs text-zinc-400">
              Description
            </Label>
            <CharacterCount
              length={description.trim().length}
              max={RESERVATION_BANNER_DESCRIPTION_MAX_LENGTH}
            />
          </div>
          <Textarea
            id={descriptionKey}
            value={description}
            placeholder={defaults.description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none border-zinc-700 bg-zinc-800"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-zinc-500">Aperçu</p>
          <div className="rounded-lg bg-primary px-4 py-3 text-center text-primary-foreground">
            <p className="flex items-center justify-center gap-2 text-sm font-bold">
              <BadgePercent className="h-5 w-5 shrink-0" aria-hidden="true" />
              {previewTitle}
            </p>
            <p className="mt-1 text-xs leading-snug opacity-80">
              {previewDescription}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={persist}
            disabled={isSaving || unchanged || titleTooLong || descriptionTooLong}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReservationBannerSettings({
  settings,
  onUpdate,
}: {
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold">Bandeau tarifs</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Ce bandeau s’affiche sur la page de réservation, à l’étape du choix du
          créneau. Son contenu change selon le type de groupe sélectionné.
          Laissez un champ vide pour utiliser le texte par défaut.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {RESERVATION_BANNER_GROUP_KEYS.map((group) => (
          <BannerGroupCard
            key={group}
            group={group}
            settings={settings}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
