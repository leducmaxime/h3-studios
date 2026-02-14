"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { Music, Radio, Calendar } from "lucide-react";
import { useEffect, useState } from "react";

const services = [
  {
    icon: Music,
    title: "Location de studios",
    description: "Deux espaces professionnels pour vos répétitions",
  },
  {
    icon: Radio,
    title: "Répétitions",
    description: "Environnement optimal pour travailler votre son",
  },
  {
    icon: Calendar,
    title: "Privatisation",
    description: "Réservez nos espaces pour vos événements privés",
  },
];

export function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center pb-20 pt-32">
      <ScrollUp />

      <div className="w-full max-w-6xl px-4">
        <div className="mb-16 text-center">
          <img
            src="/images/home/1.png"
            alt="H3 Studios"
            className="mx-auto mb-8 w-full max-w-2xl"
          />
          <img
            src="/images/home/2.png"
            alt="Répétitions - Enregistrements"
            className="mx-auto w-full max-w-xl"
          />
          <div className="mx-auto mt-8 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="mt-6 text-lg text-white/60">
            Studios de répétition et enregistrement à Sucy-en-Brie
          </p>
        </div>

        <div className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const Icon = service.icon;
            return (
              <div
                key={i}
                className={`group flex flex-col items-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-6 text-center transition-all duration-700 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(249,176,53,0.15)] ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:scale-110">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 font-blanka text-lg text-primary">
                  {service.title}
                </h3>
                <p className="text-sm text-white/60">{service.description}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <a href="/reservation">
            <button className="group relative overflow-hidden rounded-full bg-primary px-16 py-6 text-2xl font-bold text-black shadow-[0_0_50px_rgba(249,176,53,0.3)] transition-all hover:scale-110 hover:shadow-[0_0_80px_rgba(249,176,53,0.6)] md:px-20 md:py-8 md:text-3xl">
              <span className="relative z-10">Réserver maintenant</span>
              <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </a>
          <p className="mt-6 text-base text-white/50">
            Ouvert 7j/7 • Uniquement sur réservation
          </p>
        </div>
      </div>
    </div>
  );
}
