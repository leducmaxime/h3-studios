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

const studioEquipment = {
  laScene: {
    name: "La Scène",
    size: "42m²",
    items: [
      { icon: Drum, category: "Batterie", equipment: "YAMAHA recording 9000 6 fûts (caisse claire Premier série pro XPK)" },
      { icon: Guitar, category: "Amplis Basse", equipment: "Trace Eliot GP7 SM 250w (rms) + Boomer Fender 300w (rms)" },
      { icon: Radio, category: "Amplis Guitare", equipment: "Marshall Valvestate VS 265, Fender performer 1000, Laney GC 120c, Marshall acoustic AS 50D, Hugues & Kettner Warp 7" },
      { icon: Volume2, category: "Table de mixage", equipment: "Mackie SR 24.4, Compresseur Boss CL-50, Reverb TC Electronic M-2000, EQ Alesis M-EQ230" },
      { icon: Headphones, category: "Amplification", equipment: "Dynacord L2800 FD, Montarbo 402, Enceintes DAS 2x400w, caisson basse 2x500w" },
      { icon: Mic2, category: "Retours", equipment: "Ampli ROSS méga Amp 800, Enceintes DAS 2x300w, Laney amplifiés 2x200w" },
    ],
  },
  lePodium: {
    name: "Le Podium",
    size: "35m²",
    items: [
      { icon: Drum, category: "Batterie", equipment: "Pearl DLX pro 6 fûts (Cymbale ride + Charlé Sabian)" },
      { icon: Guitar, category: "Amplis Basse", equipment: "AMPEQ Rocket bass RB210 500w" },
      { icon: Radio, category: "Amplis Guitare", equipment: "Marshall Valvestate 80V, Fender Superamp, Roland acoustic Chorus AC-60, Vox DA5" },
      { icon: Volume2, category: "Table de mixage", equipment: "YAMAHA EMX 2000 effets intégrés" },
      { icon: Headphones, category: "Amplification", equipment: "Dynacord PAA 300, Bose 802 série II / DAS / Ross (2x450w en tout), caisson 502B" },
      { icon: Mic2, category: "Retours", equipment: "Ampli aeq 301, Enceintes ROSS" },
    ],
  },
};

const recordingEquipment = [
  { icon: Mic2, category: "Micros Chant", equipment: ["SHURE SM58 x 2", "SM58 beta x 3", "Sennheiser MD 425", "BF811 x2"] },
  { icon: Drum, category: "Micros Batterie", equipment: ["AKG D112 x2", "Sennheiser e 602", "SM 57", "Fûts e604, Blackfire 504/604/521 x3", "Overhead Sennheiser x2, Shure SM 81"] },
  { icon: Guitar, category: "Micros Instruments", equipment: ["AKG D112", "Sennheiser e609 x2"] },
  { icon: Cpu, category: "Carte son", equipment: ["Focusrite Scarlett 20 pistes"] },
  { icon: Laptop, category: "Logiciels", equipment: ["Reaper", "FL Studio"] },
];

const rentalEquipment = [
  { icon: Guitar, category: "Basses / Guitares", equipment: ["TUNE 5 cordes", "Eagle", "Greg Bi"] },
  { icon: Piano, category: "Claviers", equipment: ["Roland RD-300 SX", "Ensoniq VFX", "Korg M1"] },
  { icon: Component, category: "Percussions", equipment: ["Cajon SELA", "Darbouka Meinl"] },
  { icon: Music, category: "Cymbales", equipment: ["Istanbul agop 16'' + 18''", "ZILDJIAN Série K 18''", "Meinl Rakes 14''", "TOSCO 18''", "ZILDJIAN Flashsplash 8''"] },
  { icon: Cpu, category: "Effets & Numérique", equipment: ["V-AMP 2 Behringer", "Native machine+ et M32"] },
];

function EquipmentCard({ item, index, isVisible }: { item: { icon: React.ElementType; category: string; equipment: string }; index: number; isVisible: boolean }) {
  const Icon = item.icon;
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

function RecordingCard({ item, index, isVisible }: { item: { icon: React.ElementType; category: string; equipment: string[] }; index: number; isVisible: boolean }) {
  const Icon = item.icon;
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
        {item.equipment.map((eq, i) => (
          <li key={i} className="text-xs text-white/60 flex items-center gap-2">
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

  useEffect(() => {
    setIsVisible(true);
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
          {[studioEquipment.laScene, studioEquipment.lePodium].map((studio, studioIndex) => (
            <div
              key={studio.name}
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
                  <EquipmentCard key={i} item={item} index={i} isVisible={isVisible} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <div className="mb-8 text-center">
            <h2 className="font-blanka text-2xl md:text-3xl">ÉQUIPEMENT D'ENREGISTREMENT</h2>
            <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-primary/50" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recordingEquipment.map((item, i) => (
              <RecordingCard key={i} item={item} index={i} isVisible={isVisible} />
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
            {rentalEquipment.map((item, i) => (
              <RecordingCard key={i} item={item} index={i} isVisible={isVisible} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
