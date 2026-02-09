"use client";

import { Music, Mic } from "lucide-react";
import {
  type StudioId,
  type GroupType,
  STUDIOS,
  calculatePrice,
  formatPrice,
  formatDuration,
} from "@/lib/booking";

interface StudioCardProps {
  studioId: StudioId;
  date: Date;
  startTime: string;
  endTime: string;
  groupType: GroupType;
  onSelect: () => void;
  availability: Set<string>;
}

export function StudioCard({
  studioId,
  date,
  startTime,
  endTime,
  groupType,
  onSelect,
  availability,
}: StudioCardProps) {
  const studio = STUDIOS[studioId];
  const { total, breakdown } = calculatePrice(studioId, groupType, date, startTime, endTime);
  const duration = formatDuration(startTime, endTime);

  const hasUnavailableSlots = breakdown.some((slot) =>
    availability.has(`${studioId}-${slot.time}`)
  );

  const hasPeakSlots = breakdown.some((slot) => slot.isPeak);
  const hasOffPeakSlots = breakdown.some((slot) => !slot.isPeak);
  const isMixedPricing = hasPeakSlots && hasOffPeakSlots;

  const peakTotal = breakdown
    .filter((s) => s.isPeak)
    .reduce((sum, s) => sum + (s.rate * 30) / 60, 0);
  const offPeakTotal = breakdown
    .filter((s) => !s.isPeak)
    .reduce((sum, s) => sum + (s.rate * 30) / 60, 0);

  const Icon = studioId === "la-scene" ? Mic : Music;

  return (
    <div
      className={`
        flex flex-col gap-4 overflow-hidden rounded-xl border-2 transition-all
        ${hasUnavailableSlots
          ? "border-white/20 bg-white/5 opacity-60"
          : "border-primary/50 bg-black hover:border-primary hover:bg-primary/5"
        }
      `}
    >
      <div className="relative h-32 w-full overflow-hidden">
        <img
          src={studio.image}
          alt={studio.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-2 left-3 flex items-center gap-2">
          <div className="rounded-md bg-primary/90 p-1.5">
            <Icon className="h-4 w-4 text-black" />
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">{studio.name}</h3>
            <p className="text-xs text-white/70">{studio.size}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4">
        <p className="text-sm text-white/70">{studio.description}</p>

        <div className="flex flex-wrap gap-1">
          {studio.features.map((feature) => (
            <span
              key={feature}
              className="rounded-full bg-white/10 px-2 py-0.5 text-xs"
            >
              {feature}
            </span>
          ))}
        </div>

        <div className="rounded-lg bg-white/5 p-3">
          {hasUnavailableSlots ? (
            <div className="text-center text-white/50">
              Non disponible sur ce créneau
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/70">{duration}</span>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(total)}
                </span>
              </div>
              
              {isMixedPricing && (
                <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-xs text-white/60">
                  {offPeakTotal > 0 && (
                    <div className="flex justify-between">
                      <span>Tarif normal</span>
                      <span>{formatPrice(offPeakTotal)}</span>
                    </div>
                  )}
                  {peakTotal > 0 && (
                    <div className="flex justify-between">
                      <span>Soir & week-end ⚡</span>
                      <span>{formatPrice(peakTotal)}</span>
                    </div>
                  )}
                </div>
              )}
              
              {!isMixedPricing && hasPeakSlots && (
                <div className="mt-1 text-xs text-primary/80">
                  Tarif soir & week-end / jour férié
                </div>
              )}
            </>
          )}
        </div>

        <button
          onClick={onSelect}
          disabled={hasUnavailableSlots}
          className={`
            w-full rounded-lg py-3 font-semibold transition-all
            ${hasUnavailableSlots
              ? "bg-white/10 text-white/30 cursor-not-allowed"
              : "bg-primary text-black hover:bg-primary/90"
            }
          `}
        >
          {hasUnavailableSlots ? "Indisponible" : "Sélectionner"}
        </button>
      </div>
    </div>
  );
}
