"use client";

import { ChevronLeft, Check } from "lucide-react";
import { STUDIOS, PRICING, type StudioId, type GroupType } from "@/lib/booking";

interface StudioPickerProps {
  onSelect: (studioId: StudioId) => void;
  onBack: () => void;
  groupType: GroupType;
}

export function StudioPicker({ onSelect, onBack, groupType }: StudioPickerProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-full p-2 transition-colors hover:bg-white/10"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-white/60">Choisissez votre studio</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(STUDIOS) as StudioId[]).map((studioId) => {
          const studio = STUDIOS[studioId];
          const pricing = PRICING[studioId][groupType];
          const priceText = pricing.offPeak === pricing.peak
            ? `${pricing.offPeak}€/h`
            : `${pricing.offPeak}€ - ${pricing.peak}€/h`;
          
          return (
            <button
              key={studioId}
              onClick={() => onSelect(studioId)}
              className="group flex flex-col overflow-hidden rounded-xl border-2 border-white/20 bg-white/5 text-left transition-all hover:border-primary hover:bg-primary/10"
            >
              <div className="relative h-40 w-full overflow-hidden">
                <img
                  src={studio.image}
                  alt={studio.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white drop-shadow-lg">{studio.name}</h4>
                    <p className="text-sm text-primary drop-shadow-lg">{studio.size}</p>
                  </div>
                  <div className="rounded-full bg-primary/90 px-3 py-1 text-sm font-semibold text-black">
                    {priceText}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <p className="text-sm text-white/70">{studio.description}</p>
                <div className="flex flex-wrap gap-2">
                  {studio.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full bg-white/10 px-2 py-1 text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
