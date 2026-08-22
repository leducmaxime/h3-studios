"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

interface HelpCard {
  title: string;
  body: string;
}

const calendarHelp: HelpCard[] = [
  {
    title: "Créer une réservation",
    body: "Cliquez un créneau libre : le studio et l'horaire sont déjà remplis. Il reste à choisir le client.",
  },
  {
    title: "Déplacer une session",
    body: "Cliquez la réservation, puis Déplacer. Le créneau d'arrivée doit être libre.",
  },
  {
    title: "Bloquer un créneau",
    body: "Pour une fermeture ou une maintenance, utilisez Blocages d'agenda. Ne créez pas une fausse réservation.",
  },
  {
    title: "Lire les couleurs",
    body: "Vert : payé. Ambre : reste à payer. Jaune : absent. Survolez une session pour le détail.",
  },
];

const bookingsHelp: HelpCard[] = [
  {
    title: "Encaisser sur place",
    body: "Ouvrez la fiche, puis enregistrez le paiement (espèces, carte, virement ou chèque).",
  },
  {
    title: "Annuler ou marquer absent",
    body: "Annuler libère le créneau. Marquer absent garde la session au planning : le client n'est pas venu.",
  },
  {
    title: "Remises",
    body: "Code promo, remise manuelle et ristourne fidélité ne se cumulent pas. La remise manuelle remplace les autres.",
  },
  {
    title: "Rembourser",
    body: "Carte en ligne : remboursement Stripe depuis la fiche. Espèces ou autre : ajustez selon l'encaissement réel.",
  },
];

function helpForPath(pathname: string): { heading: string; intro: string; cards: HelpCard[] } | null {
  if (pathname.startsWith("/admin/calendar")) {
    return {
      heading: "Calendrier",
      intro: "Le planning du jour : créer, déplacer, lire les statuts.",
      cards: calendarHelp,
    };
  }
  if (pathname.startsWith("/admin/bookings")) {
    return {
      heading: "Réservations",
      intro: "Les actions qui touchent l'encaissement et le planning.",
      cards: bookingsHelp,
    };
  }
  return null;
}

export function HelpPanel({ open, onOpenChange, pathname, triggerRef }: HelpPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange, triggerRef]);

  const close = () => {
    onOpenChange(false);
    triggerRef.current?.focus();
  };

  if (!open || typeof document === "undefined") return null;

  const help = helpForPath(pathname);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={close}
        aria-hidden="true"
      />
      <aside
        id="admin-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-help-title"
        className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 id="admin-help-title" className="text-lg font-semibold">
              Aide{help ? ` — ${help.heading}` : ""}
            </h2>
            {help && <p className="mt-0.5 text-xs text-zinc-500">{help.intro}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Fermer l'aide"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {help ? (
            <div className="space-y-3">
              {help.cards.map((card) => (
                <section key={card.title} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                  <h3 className="font-medium text-zinc-100">{card.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{card.body}</p>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed text-zinc-400">
              <p>Cette page n'a pas encore de recettes dédiées.</p>
              <p>
                L'aide détaillée est sur le{" "}
                <a href="/admin/calendar" className="text-primary underline underline-offset-2">
                  calendrier
                </a>{" "}
                et les{" "}
                <a href="/admin/bookings" className="text-primary underline underline-offset-2">
                  réservations
                </a>
                {" "}— les deux endroits où une erreur coûte du temps ou de l'argent.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
