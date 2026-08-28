"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getParisDateISO } from "@/lib/utils";
import { type DbPromoCode } from "@/lib/db-types";

interface LoyaltyCodeExpiryEditorProps {
  promo: DbPromoCode;
  onUpdated: (updated: { expires_at: string }) => void;
}

/**
 * Édition de la date d'expiration d'un code fidélité, depuis la cellule
 * "Expiration" du tableau. Popover plutôt qu'édition inline en place : la
 * ligne ne bouge pas d'un pixel à l'ouverture, ce qui compte dans un
 * tableau dense consulté rapidement, et le même composant s'insère sans
 * ajustement dans les deux densités (UserDetail / Pricing).
 *
 * Une date passée reste acceptée — c'est le moyen prévu de révoquer un
 * code par anticipation — mais signalée avant validation pour que le clic
 * ne soit pas accidentel.
 */
export function LoyaltyCodeExpiryEditor({ promo, onUpdated }: LoyaltyCodeExpiryEditorProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(promo.expires_at ? promo.expires_at.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  // Repart de la date actuelle à chaque ouverture, y compris si le popover
  // a déjà servi une fois pour ce code (annulation, puis réouverture).
  useEffect(() => {
    if (open) setValue(promo.expires_at ? promo.expires_at.slice(0, 10) : "");
  }, [open, promo.expires_at]);

  const todayISO = getParisDateISO();
  const isPast = value !== "" && value < todayISO;

  // Un code déjà consommé ne se prolonge pas : sa date d'expiration n'a plus
  // aucun effet. Même logique que le bouton de renvoi, qui disparaît lui aussi
  // plutôt que de proposer une action sans portée.
  if (promo.used_at) return null;

  const handleSave = async () => {
    if (!value || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/promo-codes/${promo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expires_at: value }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success(`Expiration du code ${promo.code} mise à jour`);
        onUpdated({ expires_at: value });
        setOpen(false);
      } else {
        // Le message vient du serveur (ex. 403 pour un opérateur) : on ne
        // le réécrit pas.
        toast.error(json.error || "Impossible de modifier la date d'expiration");
      }
    } catch (error) {
      console.error("Update loyalty code expiry error:", error);
      toast.error("Erreur réseau : la date d'expiration n'a pas été enregistrée");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!saving) setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Modifier la date d'expiration du code ${promo.code}`}
          className="h-6 w-6 shrink-0 p-0 text-zinc-500 hover:text-zinc-200"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>Nouvelle date d&apos;expiration</Label>
            <Input
              id={inputId}
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
              autoFocus
            />
          </div>
          {isPast && (
            <p className="text-xs text-amber-400">
              Cette date est passée : le code passera immédiatement au statut « Expiré ».
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || !value}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
