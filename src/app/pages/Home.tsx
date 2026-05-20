"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { ImageCarousel } from "@/components/common/ImageCarousel";
import {
  Music,
  Radio,
  Calendar,
  MapPin,
  TrainFront,
  Wifi,
  Clock,
  ArrowRight,
  Star,
  Mic2,
  Guitar,
  Speaker,
  Disc3,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

const services = [
  {
    icon: Music,
    title: "Répétitions",
    description:
      "Deux espaces professionnels pensés pour travailler votre son, seul ou en groupe.",
  },
  {
    icon: Radio,
    title: "Enregistrements",
    description:
      "Environnement optimal pour capturer votre musique avec un son authentique.",
  },
  {
    icon: Calendar,
    title: "Cours & Ateliers",
    description:
      "Salles adaptées aux enseignants et formateurs pour dispenser leurs cours.",
  },
];

const studios = [
  {
    name: "La Scène",
    size: "42m²",
    height: "3,50m",
    tagline: "L'intimiste",
    description:
      "Une scène avec rampe d'éclairage, idéale pour tous styles musicaux. Hauteur sous plafond de 3,50m pour une sensation d'espace unique.",
    images: [
      { src: "/images/studios/scene-2.jpg", alt: "La Scène — Studio H3" },
      { src: "/images/studios/scene-5.jpg", alt: "La Scène — Espace créatif" },
      { src: "/images/studios/scene-3.jpg", alt: "La Scène — Répétition" },
    ],
  },
  {
    name: "Le Podium",
    size: "35m²",
    height: "2,80m",
    tagline: "Le fonctionnel",
    description:
      "Conçu pour la répétition et les cours. Un cadre simple, chaleureux et parfaitement insonorisé pour vos sessions.",
    images: [
      { src: "/images/studios/podium-2.jpg", alt: "Le Podium — Studio H3" },
      { src: "/images/studios/podium-1.jpg", alt: "Le Podium — Espace répétition" },
      { src: "/images/studios/podium-3.jpg", alt: "Le Podium — Cours de musique" },
    ],
  },
];

const equipment = [
  { icon: Disc3, label: "Batterie acoustique", desc: "Yamaha Stage Custom" },
  { icon: Guitar, label: "Amps guitare", desc: "Marshall, Fender, Vox" },
  { icon: Speaker, label: "Sono PA", desc: "Enceintes actives + sub" },
  { icon: Mic2, label: "Table de mix", desc: "Multi-canaux professionnelle" },
];

const highlights = [
  { icon: Wifi, text: "Wifi gratuit" },
  { icon: TrainFront, text: "2 min du RER A" },
  { icon: MapPin, text: "20 min de Paris" },
  { icon: Clock, text: "Ouvert 7j/7" },
  { icon: Calendar, text: "Sur réservation" },
];

function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className} ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-10 opacity-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function Home() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setHeroLoaded(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center">
      <ScrollUp />

      {/* ========== HERO ========== */}
      <section className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden">
        {/* Background image with parallax */}
        <div
          className="absolute inset-0 z-0"
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        >
          <img
            src="/images/studios/scene-1.jpg"
            alt="Studio La Scène"
            className="h-[120%] w-full object-cover"
          />
        </div>

        {/* Dark overlays */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/70 via-black/60 to-black/90" />
        <div className="absolute inset-0 z-[2] bg-gradient-to-r from-black/50 via-transparent to-black/50" />

        {/* Animated grain texture */}
        <div
          className="absolute inset-0 z-[3] opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "200px 200px",
          }}
        />

        {/* Gold ambient glow */}
        <div className="absolute bottom-0 left-1/2 z-[3] h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

        {/* Hero Content */}
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 text-center">
          {/* Eyebrow */}
          <div
            className={`mb-6 flex items-center gap-3 transition-all duration-1000 ${
              heroLoaded
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            }`}
          >
            <span className="h-px w-12 bg-primary/60" />
            <span className="text-sm font-medium uppercase tracking-[0.3em] text-primary/80">
              Sucy-en-Brie • 94
            </span>
            <span className="h-px w-12 bg-primary/60" />
          </div>

          {/* Main Title */}
          <h1
            className={`transition-all duration-1000 ${
              heroLoaded
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
            style={{ transitionDelay: "150ms" }}
          >
            <span className="block font-blanka text-6xl leading-[0.9] tracking-wider text-white sm:text-7xl md:text-8xl lg:text-9xl">
              H3 STUDIOS
            </span>
          </h1>

          {/* Tagline */}
          <p
            className={`mt-6 max-w-xl text-lg font-light leading-relaxed text-white/70 sm:text-xl md:text-2xl transition-all duration-1000 ${
              heroLoaded
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            Studios de répétition et d'enregistrement
            <span className="mt-2 block text-base text-primary/80 sm:text-lg">
              Professionnels &middot; Insonorisés &middot; Équipés
            </span>
          </p>

          {/* CTA Buttons */}
          <div
            className={`mt-10 flex flex-col items-center gap-4 sm:flex-row transition-all duration-1000 ${
              heroLoaded
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
            style={{ transitionDelay: "450ms" }}
          >
            <a
              href="/reservation"
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-primary px-10 py-4 text-lg font-bold text-black transition-all hover:shadow-[0_0_60px_rgba(255,222,89,0.3)] hover:scale-105 active:scale-95"
            >
              <Music className="h-6 w-6 transition-transform group-hover:rotate-12" />
              Réserver maintenant
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="/les-studios"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-base font-medium text-white transition-all hover:border-primary/60 hover:bg-white/5 hover:text-primary"
            >
              Découvrir les studios
            </a>
          </div>

          {/* Quick info pills */}
          <div
            className={`mt-12 flex flex-wrap items-center justify-center gap-3 transition-all duration-1000 ${
              heroLoaded
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
            style={{ transitionDelay: "600ms" }}
          >
            {highlights.slice(0, 4).map((h, i) => {
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

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-white/40">
          <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </div>
      </section>

      {/* ========== QUICK STATS STRIP ========== */}
      <section className="relative z-10 w-full border-y border-white/5 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-4 py-8 md:gap-16 md:py-10">
          {[
            { num: "2", label: "Studios professionnels" },
            { num: "77m²", label: "De surface totale" },
            { num: "30+", label: "Années d'expérience" },
            { num: "7/7", label: "Jours d'ouverture" },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <span className="font-blanka text-3xl text-primary md:text-4xl">
                {stat.num}
              </span>
              <span className="mt-1 text-xs uppercase tracking-wider text-white/50">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ========== SERVICES ========== */}
      <section className="w-full px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 text-center">
            <span className="mb-3 block text-sm font-medium uppercase tracking-[0.3em] text-primary/70">
              Nos prestations
            </span>
            <h2 className="font-blanka text-4xl text-white md:text-5xl">
              CE QUE NOUS PROPOSONS
            </h2>
            <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => {
              const Icon = service.icon;
              return (
                <Reveal key={i} delay={i * 150}>
                  <div className="group relative flex flex-col items-center rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-8 text-center transition-all duration-500 hover:-translate-y-2 hover:border-primary/40 hover:shadow-[0_0_50px_rgba(255,222,89,0.08)]">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/20">
                      <Icon className="h-8 w-8 text-primary transition-transform duration-500 group-hover:rotate-6" />
                    </div>
                    <h3 className="mb-3 font-blanka text-xl text-primary">
                      {service.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-white/60">
                      {service.description}
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========== STUDIOS SHOWCASE ========== */}
      <section className="w-full px-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 text-center">
            <span className="mb-3 block text-sm font-medium uppercase tracking-[0.3em] text-primary/70">
              Nos espaces
            </span>
            <h2 className="font-blanka text-4xl text-white md:text-5xl">
              LES STUDIOS
            </h2>
            <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
            <p className="mx-auto mt-6 max-w-2xl text-base text-white/50">
              Deux salles distinctes, chacune avec sa personnalité, pensées pour
              s'adapter à vos besoins — répétition, enregistrement ou cours.
            </p>
          </Reveal>

          <div className="grid gap-8 lg:grid-cols-2">
            {studios.map((studio, i) => (
              <Reveal key={i} delay={i * 200}>
                <div className="group overflow-hidden rounded-2xl border border-white/10 bg-black transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_60px_rgba(255,222,89,0.06)]">
                  <div className="relative aspect-video overflow-hidden">
                    <ImageCarousel
                      images={studio.images}
                      autoPlay={true}
                      interval={4000}
                    />
                    <div className="absolute left-4 top-4 z-10">
                      <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary backdrop-blur-sm">
                        {studio.tagline}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 md:p-8">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-blanka text-2xl text-primary md:text-3xl">
                        {studio.name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-white/50">
                        <span>{studio.size}</span>
                        <span className="text-white/20">|</span>
                        <span>Hauteur {studio.height}</span>
                      </div>
                    </div>
                    <p className="mb-6 text-sm leading-relaxed text-white/60">
                      {studio.description}
                    </p>
                    <a
                      href="/reservation"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-all hover:gap-3"
                    >
                      Réserver ce studio
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== EQUIPMENT / ATMOSPHERE ========== */}
      <section className="relative w-full overflow-hidden py-20 md:py-28">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />

        <div className="relative mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: Text content */}
            <div>
              <Reveal>
                <span className="mb-3 block text-sm font-medium uppercase tracking-[0.3em] text-primary/70">
                  Équipement
                </span>
                <h2 className="font-blanka text-4xl text-white md:text-5xl">
                  TOURNÉ À FOND
                </h2>
                <div className="mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-primary to-transparent" />
              </Reveal>

              <Reveal delay={150}>
                <p className="mt-6 text-base leading-relaxed text-white/60">
                  Nos studios sont équipés de matériel professionnel soigneusement
                  sélectionné. Batteries, amplis, sono complète, tables de mixage
                  — tout est là pour que vous n'ayez qu'à brancher et jouer.
                </p>
              </Reveal>

              <Reveal delay={250}>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {equipment.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={i}
                        className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-primary/30 hover:bg-white/[0.06]"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {item.label}
                          </p>
                          <p className="text-xs text-white/40">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Reveal>

              <Reveal delay={350}>
                <a
                  href="/le-materiel"
                  className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition-all hover:border-primary/50 hover:text-primary"
                >
                  Voir tout le matériel
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Reveal>
            </div>

            {/* Right: Photo grid */}
            <Reveal delay={200}>
              <div className="relative grid grid-cols-2 gap-3">
                <img
                  src="/images/studios/scene-4.jpg"
                  alt="Studio La Scène"
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                />
                <div className="flex flex-col gap-3">
                  <img
                    src="/images/studios/podium-4.jpg"
                    alt="Studio Le Podium"
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                  <img
                    src="/images/studios/scene-3.jpg"
                    alt="Ambiance studio"
                    className="aspect-[4/3] w-full flex-1 rounded-xl object-cover"
                  />
                </div>
                {/* Decorative border */}
                <div className="absolute -inset-3 -z-10 rounded-2xl border border-primary/10" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ========== TRUST / SOCIAL PROOF ========== */}
      <section className="w-full px-4 py-20 md:py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal className="text-center">
            <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/10" />
              <div className="absolute inset-2 rounded-full bg-primary/20" />
              <Star className="relative h-10 w-10 text-primary" />
            </div>
            <blockquote className="mx-auto max-w-2xl">
              <p className="text-xl font-light italic leading-relaxed text-white/80 md:text-2xl">
                "La musique est le langage universel qui transcende les mots.
                Notre mission est de vous offrir un espace où chaque note
                trouve sa place."
              </p>
            </blockquote>
            <div className="mt-6 flex flex-col items-center gap-1">
              <span className="text-base font-semibold text-primary">
                Marcel Hamon
              </span>
              <span className="text-sm text-white/50">
                Fondateur &middot; Musicien depuis plus de 30 ans
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========== LOCATION QUICK INFO ========== */}
      <section className="w-full border-t border-white/5 px-4 py-16">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-6 md:gap-10">
          {highlights.map((h, i) => {
            const Icon = h.icon;
            return (
              <Reveal key={i} delay={i * 100}>
                <div className="flex items-center gap-2.5 text-sm text-white/60">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span>{h.text}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="relative w-full overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />

        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <Reveal>
            <h2 className="font-blanka text-4xl leading-tight text-white md:text-5xl lg:text-6xl">
              PRÊT À JOUER ?
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
              Réservez dès maintenant votre créneau dans l'un de nos studios
              professionnels. Ouvert 7 jours sur 7, uniquement sur réservation.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="/reservation"
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-primary px-10 py-4 text-lg font-bold text-black transition-all hover:shadow-[0_0_60px_rgba(255,222,89,0.3)] hover:scale-105 active:scale-95"
              >
                <Music className="h-6 w-6 transition-transform group-hover:rotate-12" />
                Réserver maintenant
              </a>
              <a
                href="/a-propos"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-4 text-base font-medium text-white transition-all hover:border-primary/50 hover:bg-white/5 hover:text-primary"
              >
                Nous contacter
              </a>
            </div>
          </Reveal>
          <Reveal delay={450}>
            <p className="mt-6 text-xs text-white/30">
              3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie &middot; 06 13 44 08 75
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
