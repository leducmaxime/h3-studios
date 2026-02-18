"use client";

import { Calendar, Music2, ArrowRight } from "lucide-react";
import { type BookingFlow, type GroupType } from "@/lib/booking";

interface FlowChoiceProps {
  onSelect: (flow: BookingFlow) => void;
  disabled?: boolean;
  groupType?: GroupType | null;
}

export function FlowChoice({ onSelect, disabled = false, groupType }: FlowChoiceProps) {
  const isSoloDuo = groupType === "solo" || groupType === "duo";

  if (isSoloDuo && !disabled) {
    return (
      <div className="flex flex-col items-center gap-6 py-2">
        <p className="text-center text-sm font-medium text-primary/90">
          Le choix du studio se fera selon la disponibilité, priorité aux groupes.
        </p>
        <button
          onClick={() => onSelect("time-first")}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border-2 border-primary/50 bg-white/5 py-4 text-lg font-semibold text-primary transition-all hover:border-primary hover:bg-primary/10 hover:scale-[1.02]"
        >
          Continuer
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  const studioDisabled = disabled;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-medium">Comment souhaitez-vous réserver ?</h3>
        <p className="text-sm text-white/60">
          {disabled 
            ? "Sélectionnez d'abord le nombre de personnes"
            : "Choisissez votre méthode préférée pour commencer"
          }
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => !disabled && onSelect("time-first")}
          disabled={disabled}
          className={`
            group flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all
            ${disabled
              ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
              : "border-white/20 bg-white/5 hover:border-primary hover:bg-primary/10"
            }
          `}
        >
          <div className={`rounded-full p-3 transition-colors ${disabled ? "bg-white/10" : "bg-primary/20 group-hover:bg-primary/30"}`}>
            <Calendar className={`h-7 w-7 ${disabled ? "text-white/30" : "text-primary"}`} />
          </div>
          <div className="text-center">
            <span className={`block text-lg font-medium ${disabled ? "text-white/50" : ""}`}>Je choisis ma date</span>
            <span className="mt-1 block text-xs text-white/50">
              Date → Créneau → Studio
            </span>
          </div>
        </button>

        <button
          onClick={() => !studioDisabled && onSelect("studio-first")}
          disabled={studioDisabled}
          className={`
            group flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all
            ${studioDisabled
              ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
              : "border-white/20 bg-white/5 hover:border-primary hover:bg-primary/10"
            }
          `}
        >
          <div className={`rounded-full p-3 transition-colors ${studioDisabled ? "bg-white/10" : "bg-primary/20 group-hover:bg-primary/30"}`}>
            <Music2 className={`h-7 w-7 ${studioDisabled ? "text-white/30" : "text-primary"}`} />
          </div>
          <div className="text-center">
            <span className={`block text-lg font-medium ${studioDisabled ? "text-white/50" : ""}`}>Je choisis mon studio</span>
            <span className="mt-1 block text-xs text-white/50">
              Studio → Date → Créneau
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
