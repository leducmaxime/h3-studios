"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import {
  Drum,
  Guitar,
  Volume2,
  Mic2,
  Headphones,
  Laptop,
  Music,
  Piano,
  Component,
  Cpu,
  Radio,
} from "lucide-react";
import { useEffect, useState } from "react";

import { DEFAULT_MATERIEL, type MaterielData, type MaterielIconKey, type MaterielItem, type MaterielListItem } from "@/lib/materiel";

const ICONS: Record<MaterielIconKey, React.ElementType> = {
  drum: Drum,
  guitar: Guitar,
  volume2: Volume2,
  mic2: Mic2,
  headphones: Headphones,
  laptop: Laptop,
  music: Music,
  piano: Piano,
  component: Component,
  cpu: Cpu,
  radio: Radio,
};

function EquipmentCard({ item, index, isVisible }: { item: MaterielItem; index: number; isVisible: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <div
      className={`group rounded-xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4 transition-all duration-500 hover:border-primary/30 hover:bg-white/[0.07] ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-primary">{item.category}</h4>
          <p className="mt-1 text-xs text-white/60 leading-relaxed">{item.equipment}</p>
        </div>
      </div>
    </div>
  );
}

function RecordingCard({ item, index, isVisible }: { item: MaterielListItem; index: number; isVisible: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <div
      className={`group rounded-xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-4 transition-all duration-500 hover:border-primary/30 hover:bg-white/[0.07] ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      style={{ transitionDelay: `${index * 75}ms` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
          <Icon className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-primary">{item.category}</h4>
      </div>
      <ul className="space-y-1">
        {item.equipment.map((eq) => (
          <li key={eq} className="text-xs text-white/60 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-primary/50" />
            {eq}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LeMateriel() {
  const [isVisible, setIsVisible] = useState(false);
  const [materiel, setMateriel] = useState<MaterielData>(DEFAULT_MATERIEL);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    fetch("/api/materiel")
      .then((r) => r.json() as Promise<{ success: boolean; data?: MaterielData }>)
      .then((json) => {
        if (json.success && json.data) setMateriel(json.data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center pb-20 pt-32">
      <ScrollUp />

      <div className="w-full max-w-6xl px-4">
        <div className="mb-16 text-center">
          <h1 className="font-blanka text-5xl md:text-6xl lg:text-7xl">LE MATÉRIEL</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
            Du matériel de qualité professionnelle pour des répétitions et enregistrements dans les meilleures conditions
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          {(["laScene", "lePodium"] as const).map((studioKey, studioIndex) => {
            const studio = materiel.studios[studioKey];
            return (
            <div
              key={studioKey}
              className={`transition-all duration-700 ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: `${studioIndex * 150}ms` }}
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Music className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary">{studio.name}</h2>
                  <p className="text-sm text-white/50">{studio.size}</p>
                </div>
              </div>
              <div className="grid gap-3">
                {studio.items.map((item, i) => (
                  <EquipmentCard key={item.id} item={item} index={i} isVisible={isVisible} />
                ))}
              </div>
            </div>
            );
          })}
        </div>

        <div className="mt-20">
          <div className="mb-8 text-center">
            <h2 className="font-blanka text-2xl md:text-3xl">ÉQUIPEMENT D'ENREGISTREMENT</h2>
            <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-primary/50" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {materiel.recording.map((item, i) => (
              <RecordingCard key={item.id} item={item} index={i} isVisible={isVisible} />
            ))}
          </div>
        </div>

        <div className="mt-20">
          <div className="mb-8 text-center">
            <h2 className="font-blanka text-2xl md:text-3xl">LOCATION D'INSTRUMENTS</h2>
            <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-primary/50" />
            <p className="mt-3 text-sm text-white/50">Disponibles sur demande lors de votre réservation</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {materiel.rental.map((item, i) => (
              <RecordingCard key={item.id} item={item} index={i} isVisible={isVisible} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
