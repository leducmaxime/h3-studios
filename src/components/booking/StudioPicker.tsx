"use client";

import { ChevronLeft, Check } from "lucide-react";
import { STUDIOS, type StudioId } from "@/lib/booking";

interface StudioPickerProps {
  onSelect: (studioId: StudioId) => void;
  onBack: () => void;
}

export function StudioPicker({ onSelect, onBack }: StudioPickerProps) {
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
          return (
            <button
              key={studioId}
              onClick={() => onSelect(studioId)}
              className="group flex flex-col gap-3 rounded-xl border-2 border-white/20 bg-white/5 p-5 text-left transition-all hover:border-primary hover:bg-primary/10"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-semibold">{studio.name}</h4>
                  <p className="text-sm text-primary">{studio.size}</p>
                </div>
                <div className="rounded-full bg-white/10 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Check className="h-4 w-4" />
                </div>
              </div>
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
