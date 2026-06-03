"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { ArrowRight, Music, Radio, Calendar, Star, Wifi, TrainFront, MapPin, Clock } from "lucide-react";
import { useEffect, useState } from "react";

const services = [
  {
    icon: Music,
    title: "Location de studios",
    description: "Deux espaces professionnels pour vos répétitions ou évènement divers",
  },
  {
    icon: Radio,
    title: "REPETITIONS",
    description: "Environnement optimal pour travailler votre son, pensé pour chacun !",
  },
  {
    icon: Calendar,
    title: "Privatisation",
    description: "Réservez nos espaces pour vos événements privés, contactez-nous !",
  },
];

export function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center pb-16 pt-32">
      <ScrollUp />

      <div className="w-full max-w-6xl px-4">
        <div className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center md:min-h-[calc(100dvh-8rem)]">
          <div className={`mb-8 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
            <img
              src="/images/home/hero.webp"
              srcSet="/images/home/hero-768.webp 768w, /images/home/hero.webp 1306w"
              sizes="(max-width: 768px) 100vw, 672px"
              alt="H3 Studios"
              width={1344}
              height={880}
              className="mx-auto w-full max-w-2xl"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />

          </div>

          <div className={`mb-8 flex flex-col items-center gap-4 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "100ms" }}>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <a
                href="/reservation"
                className="group inline-flex items-center justify-center gap-3 rounded-lg bg-primary px-10 py-4 text-xl font-bold text-black transition-all hover:bg-primary/90 md:px-12 md:py-5 md:text-2xl"
              >
                <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1 md:h-7 md:w-7" />
                Réserver maintenant
              </a>
              <a
                href="/les-studios"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-black px-8 py-4 text-base font-medium text-white transition-all hover:border-primary/60 hover:bg-black/80 hover:text-primary md:px-10 md:py-5 md:text-lg"
              >
                Découvrir les studios
              </a>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              {[
                { icon: Wifi, text: "Wifi gratuit" },
                { icon: TrainFront, text: "2 min du RER A Sucy-Bonneuil" },
                { icon: MapPin, text: "20 min de Paris" },
                { icon: Clock, text: "Ouvert 7j/7" },
              ].map((h, i) => {
                const Icon = h.icon;
                return (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 backdrop-blur-sm"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {h.text}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const Icon = service.icon;
            return (
              <div
                key={i}
                className={`group flex flex-col items-center rounded-2xl border border-white/10 bg-black p-6 text-center transition-all duration-700 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(249,176,53,0.15)] ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
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

        {/* Quote */}
        <div className={`mx-auto mt-20 max-w-5xl text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "600ms" }}>
          <div className="mb-6 flex justify-center">
            <Star className="h-8 w-8 text-primary/60" />
          </div>
          <blockquote className="text-xl font-light italic leading-relaxed text-white/80 md:text-2xl">
            "La musique est le langage universel qui transcende les mots.
            <br />
            Notre mission est de vous offrir un espace où chaque note trouve sa place."
          </blockquote>
          <div className="mt-4 h-1 w-16 mx-auto rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="mt-4 text-sm font-semibold text-primary">H3 Studios</p>
        </div>
      </div>
    </div>
  );
}
