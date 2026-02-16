"use client";

import { useState, useEffect } from "react";
import { TimePickerAlternatives } from "@/components/booking/TimePickerAlternatives";
import { ChevronLeft } from "lucide-react";

export function TimePickerDemo() {
  const [availability, setAvailability] = useState<Set<string>>(new Set());
  const today = new Date();

  useEffect(() => {
    const mockAvailability = new Set([
      "la-scene-14:00",
      "la-scene-14:30",
      "le-podium-18:00",
      "le-podium-18:30",
    ]);
    setAvailability(mockAvailability);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <div className="text-center font-blanka text-3xl md:text-5xl">
        PROPOSITIONS UX
      </div>
      
      <div className="w-full max-w-none sm:max-w-[900px] -mx-4 sm:mx-0">
        <div className="relative overflow-hidden rounded-2xl border-4 border-primary bg-black/80 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

          <div className="relative p-4 sm:p-6 md:p-8">
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => window.history.back()}
                className="rounded-full p-2 transition-colors hover:bg-white/10"
                aria-label="Retour"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold">Choix de l&apos;heure et de la durée</h2>
                <p className="text-sm text-white/60">
                  4 propositions d&apos;interface pour la sélection de créneau horaire
                </p>
              </div>
            </div>

            <TimePickerAlternatives
              date={today}
              availability={availability}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl text-center text-sm text-white/60">
        <p className="mb-4">
          Ces 4 propositions explorent différentes approches pour la sélection 
          de créneau horaire :
        </p>
        <ul className="space-y-2 text-left inline-block">
          <li><strong className="text-primary">1. Timeline Visuelle</strong> — Vue type planning/Gantt de toute la journée</li>
          <li><strong className="text-primary">2. Wizard Moderne</strong> — Étapes guidées avec feedback immédiat</li>
          <li><strong className="text-primary">3. Vue Condensée</strong> — Blocs horaires extensibles, très compact</li>
          <li><strong className="text-primary">4. Interface Conversationnelle</strong> — Style chatbot interactif</li>
        </ul>
      </div>
    </div>
  );
}
