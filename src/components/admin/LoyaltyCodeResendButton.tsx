"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { type DbPromoCode } from "@/lib/db-types";

interface LoyaltyCodeResendButtonProps {
  promo: DbPromoCode;
  /** Le parent ne doit monter ce composant que pour un code renvoyable
   * (cf. `isLoyaltyCodeResendable`) : pas de bouton grisé, l'action n'existe
   * simplement pas sur les lignes où elle n'a aucun sens. */
  onResent: (updated: { notified_at: string }) => void;
}

/**
 * Un seul composant, deux niveaux d'insistance selon `notified_at` :
 * - non notifié : correctif d'incident. Bouton plein, libellé visible,
 *   teinte ambre reprenant exactement celle du badge "Email non envoyé"
 *   pour que les deux se lisent comme une seule unité (constat + action).
 * - déjà notifié : action de confort (le client a perdu l'email, il
 *   rappelle). Icône seule, discrète, même traitement que les actions de
 *   ligne du tableau des codes manuels.
 */
export function LoyaltyCodeResendButton({ promo, onResent }: LoyaltyCodeResendButtonProps) {
  const [sending, setSending] = useState(false);
  const urgent = !promo.notified_at;

  const handleResend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/promo-codes/${promo.id}/resend`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { id: string; code: string; notified_at: string };
        error?: string;
      };
      if (json.success && json.data) {
        toast.success(`Email renvoyé pour le code ${json.data.code}`);
        onResent({ notified_at: json.data.notified_at });
      } else {
        // Le message vient du serveur, rédigé pour le gérant : on ne le
        // réécrit pas.
        toast.error(json.error || "Erreur lors de l'envoi de l'email");
      }
    } catch (error) {
      console.error("Resend loyalty code error:", error);
      toast.error("Erreur réseau lors de l'envoi de l'email");
    } finally {
      setSending(false);
    }
  };

  if (urgent) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={sending}
        className="h-7 gap-1.5 border-amber-500/30 bg-amber-500/15 px-2.5 text-[11px] font-medium text-amber-400 hover:bg-amber-500/25 hover:text-amber-300"
      >
        {sending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Send className="h-3 w-3" />
        )}
        {sending ? "Envoi..." : "Renvoyer l'email"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleResend}
      disabled={sending}
      title="Renvoyer l'email au client"
      className="h-7 w-7 p-0"
    >
      {sending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
      ) : (
        <Send className="h-3.5 w-3.5 text-zinc-500" />
      )}
      <span className="sr-only">Renvoyer l&apos;email</span>
    </Button>
  );
}
