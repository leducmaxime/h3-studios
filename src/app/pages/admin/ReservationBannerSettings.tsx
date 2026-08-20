"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ReservationBannerIcon,
  RESERVATION_BANNER_ICON_COMPONENTS,
} from "@/components/common/ReservationBannerIcon";
import {
  DEFAULT_RESERVATION_BANNER,
  RESERVATION_BANNER_DESCRIPTION_MAX_LENGTH,
  RESERVATION_BANNER_GROUP_KEYS,
  RESERVATION_BANNER_GROUP_LABELS,
  RESERVATION_BANNER_ICON_KEYS,
  RESERVATION_BANNER_ICON_LABELS,
  RESERVATION_BANNER_TITLE_MAX_LENGTH,
  isReservationBannerIconKey,
  reservationBannerSettingKey,
  type ReservationBannerGroupKey,
  type ReservationBannerIconKey,
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
  const iconKey = reservationBannerSettingKey(group, "icon");

  const defaults = DEFAULT_RESERVATION_BANNER[group];

  const savedTitle = settings[titleKey] ?? "";
  const savedDescription = settings[descriptionKey] ?? "";
  const savedIconRaw = settings[iconKey] ?? "";
  const savedIcon: ReservationBannerIconKey = isReservationBannerIconKey(
    savedIconRaw,
  )
    ? savedIconRaw
    : defaults.icon;

  const [title, setTitle] = useState(savedTitle);
  const [description, setDescription] = useState(savedDescription);
  const [icon, setIcon] = useState<ReservationBannerIconKey>(savedIcon);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setTitle(savedTitle);
    setDescription(savedDescription);
    setIcon(savedIcon);
  }, [savedTitle, savedDescription, savedIcon]);

  const previewTitle = title.trim() || defaults.title;
  const previewDescription = description.trim() || defaults.description;

  const titleTooLong = title.trim().length > RESERVATION_BANNER_TITLE_MAX_LENGTH;
  const descriptionTooLong =
    description.trim().length > RESERVATION_BANNER_DESCRIPTION_MAX_LENGTH;
  const unchanged =
    title.trim() === savedTitle.trim() &&
    description.trim() === savedDescription.trim() &&
    icon === savedIcon;

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

    if (icon !== savedIcon) {
      const ok = await saveSetting(iconKey, icon);
      if (!ok) {
        setSaving(null);
        return;
      }
      onUpdate(iconKey, icon);
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
            Contenu affiché quand le client choisit ce type de groupe
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
          <Label className="text-xs text-zinc-400">Icône</Label>
          <div
            role="radiogroup"
            aria-label={`Icône du bandeau ${RESERVATION_BANNER_GROUP_LABELS[group]}`}
            className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 p-2 xl:grid-cols-7"
          >
            {RESERVATION_BANNER_ICON_KEYS.map((key) => {
              const Icon = RESERVATION_BANNER_ICON_COMPONENTS[key];
              const selected = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={RESERVATION_BANNER_ICON_LABELS[key]}
                  title={RESERVATION_BANNER_ICON_LABELS[key]}
                  onClick={() => setIcon(key)}
                  className={`flex aspect-square items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-800 ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent text-zinc-400 hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-zinc-500">Aperçu</p>
          <div className="rounded-lg bg-primary px-4 py-3 text-center text-primary-foreground">
            <p className="flex items-center justify-center gap-2 text-sm font-bold">
              <ReservationBannerIcon name={icon} className="h-5 w-5 shrink-0" />
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
