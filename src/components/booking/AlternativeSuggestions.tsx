"use client";

import { Clock, Music } from "lucide-react";
import {
  type AlternativeSlot,
  STUDIOS,
  formatDate,
  formatPrice,
  calculatePrice,
} from "@/lib/booking";

interface AlternativeSuggestionsProps {
  alternatives: AlternativeSlot[];
  onSelect: (alt: AlternativeSlot) => void;
  groupType?: "solo" | "duo" | "group";
}

const REASON_BADGES: Record<AlternativeSlot["reason"], { label: string; className: string }> = {
  "same-time-other-studio": {
    label: "Autre studio",
    className: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  },
  "same-day": {
    label: "Même jour",
    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  "nearby-day": {
    label: "Jour proche",
    className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
};

export function AlternativeSuggestions({
  alternatives,
  onSelect,
  groupType = "group",
}: AlternativeSuggestionsProps) {
  const displayAlternatives = alternatives.slice(0, 5);

  if (displayAlternatives.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-white/70">
        <Clock className="h-4 w-4" />
        <p className="text-sm">
          Ce créneau n'est pas disponible. Voici des alternatives :
        </p>
      </div>

      <div className="grid gap-2">
        {displayAlternatives.map((alt, index) => {
          const studio = STUDIOS[alt.studioId];
          const { total } = calculatePrice(
            alt.studioId,
            groupType,
            alt.date,
            alt.startTime,
            alt.endTime
          );
          const badge = REASON_BADGES[alt.reason];

          return (
            <button
              key={`${alt.studioId}-${alt.startTime}-${index}`}
              onClick={() => onSelect(alt)}
              className="group relative flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-all hover:border-primary/50 hover:bg-white/10"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-white/60 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                  <Music className="h-4 w-4" />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white truncate">
                      {studio.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <span className="text-xs text-white/50">
                    {alt.startTime} - {alt.endTime}
                    {alt.reason === "nearby-day" && (
                      <span className="ml-1.5">
                        · {formatDate(alt.date, "short")}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {formatPrice(total)}
                </span>
                <span className="rounded-md bg-primary/20 px-2.5 py-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Choisir
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
