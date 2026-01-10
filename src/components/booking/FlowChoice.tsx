"use client";

import { Calendar, Music2 } from "lucide-react";
import type { BookingFlow } from "@/lib/booking";

interface FlowChoiceProps {
  onSelect: (flow: BookingFlow) => void;
}

export function FlowChoice({ onSelect }: FlowChoiceProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-medium">Comment souhaitez-vous réserver ?</h3>
        <p className="text-sm text-white/60">
          Choisissez votre méthode préférée pour commencer
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => onSelect("time-first")}
          className="group flex flex-col items-center gap-4 rounded-xl border-2 border-white/20 bg-white/5 p-6 transition-all hover:border-primary hover:bg-primary/10"
        >
          <div className="rounded-full bg-primary/20 p-4 transition-colors group-hover:bg-primary/30">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <span className="block text-lg font-medium">Je choisis ma date</span>
            <span className="mt-1 block text-sm text-white/60">
              Date → Créneau → Studio
            </span>
          </div>
        </button>

        <button
          onClick={() => onSelect("studio-first")}
          className="group flex flex-col items-center gap-4 rounded-xl border-2 border-white/20 bg-white/5 p-6 transition-all hover:border-primary hover:bg-primary/10"
        >
          <div className="rounded-full bg-primary/20 p-4 transition-colors group-hover:bg-primary/30">
            <Music2 className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <span className="block text-lg font-medium">Je choisis mon studio</span>
            <span className="mt-1 block text-sm text-white/60">
              Studio → Date → Créneau
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
