"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { Instagram, ExternalLink, Calendar, Music } from "lucide-react";
import { useEffect, useState } from "react";

const mockPosts = [
  {
    id: 1,
    image: "/images/studios/scene-2.jpg",
    caption: "Nouvelles installations dans le studio La Scène !",
    date: "12 février 2025",
    likes: 45,
  },
  {
    id: 2,
    image: "/images/studios/podium-1.jpg",
    caption: "Répétition du groupe @TribaMondo ce weekend",
    date: "8 février 2025",
    likes: 32,
  },
  {
    id: 3,
    image: "/images/studios/scene-3.jpg",
    caption: "Le matériel arrive pour les sessions d'enregistrement",
    date: "5 février 2025",
    likes: 28,
  },
  {
    id: 4,
    image: "/images/studios/podium-2.jpg",
    caption: "Profitez de nos tarifs préférentiels en semaine !",
    date: "1 février 2025",
    likes: 51,
  },
  {
    id: 5,
    image: "/images/studios/scene-1.jpg",
    caption: "La Scène prête pour vos prochains concerts",
    date: "28 janvier 2025",
    likes: 39,
  },
  {
    id: 6,
    image: "/images/studios/podium-3.jpg",
    caption: "Cours de batterie disponibles au Podium",
    date: "24 janvier 2025",
    likes: 27,
  },
];

export function Actualites() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center pb-20 pt-32">
      <ScrollUp />

      <div className="w-full max-w-6xl px-4">
        <div className="mb-12 text-center">
          <h1 className="font-blanka text-5xl md:text-6xl lg:text-7xl">ACTUALITÉS</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
            Suivez nos dernières nouvelles et découvertes sur nos réseaux sociaux
          </p>
        </div>

        <a
          href="https://www.instagram.com/h3_studios_sucy"
          target="_blank"
          rel="noopener noreferrer"
          className="group mx-auto mb-16 flex max-w-md items-center justify-center gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 transition-all hover:border-primary hover:bg-primary/20"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20 transition-colors group-hover:bg-primary/30">
            <Instagram className="h-7 w-7 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-lg font-semibold text-primary">@h3_studios_sucy</p>
            <p className="text-sm text-white/60">Suivez-nous sur Instagram</p>
          </div>
          <ExternalLink className="ml-auto h-5 w-5 text-white/40 transition-colors group-hover:text-primary" />
        </a>

        <div className="mb-12 text-center">
          <h2 className="font-blanka text-2xl md:text-3xl">DERNIÈRES PUBLICATIONS</h2>
          <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-primary/50" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mockPosts.map((post, i) => (
            <a
              key={post.id}
              href="https://www.instagram.com/h3_studios_sucy"
              target="_blank"
              rel="noopener noreferrer"
              className={`group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent transition-all duration-700 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(249,176,53,0.1)] ${
                isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={post.image}
                  alt={post.caption}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <p className="text-sm text-white line-clamp-2">{post.caption}</p>
                </div>
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                  <Instagram className="h-3 w-3" />
                  {post.likes}
                </div>
              </div>
              <div className="p-4">
                <p className="mb-2 line-clamp-2 text-sm text-white/70">{post.caption}</p>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Calendar className="h-3 w-3" />
                  {post.date}
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="https://www.instagram.com/h3_studios_sucy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-black transition-all hover:bg-primary/90"
          >
            <Instagram className="h-5 w-5" />
            Voir toutes les publications
          </a>
        </div>
      </div>
    </div>
  );
}
