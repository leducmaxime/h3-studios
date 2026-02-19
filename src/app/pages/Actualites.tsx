"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { Instagram, ExternalLink, Calendar, Music } from "lucide-react";
import { useEffect, useState } from "react";

interface InstagramPost {
  id: string;
  caption: string;
  media_type: string;
  media_url: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
}

export function Actualites() {
  const [isVisible, setIsVisible] = useState(false);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    fetch("/api/instagram/feed")
      .then(res => res.json())
      .then((data: any) => {
        if (data.success && Array.isArray(data.data)) {
          setPosts(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="flex min-h-fit grow flex-col items-center pb-20 pt-32">
      <ScrollUp />

      <div className="w-full max-w-6xl px-4">
        <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
          <h1 className="font-blanka text-5xl md:text-6xl lg:text-7xl">ACTUALITÉS</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        <div className={`transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "100ms" }}>
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
        </div>

        <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "200ms" }}>
          <h2 className="font-blanka text-2xl md:text-3xl">DERNIÈRES PUBLICATIONS</h2>
          <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-primary/50" />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center text-white/40">
            Aucune publication trouvée.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className={`group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent transition-all duration-700 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(249,176,53,0.1)] ${
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
                style={{ transitionDelay: `${300 + i * 100}ms` }}
              >
                <div className="relative aspect-square overflow-hidden bg-zinc-900">
                  <img
                    src={post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url}
                    alt={post.caption}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="text-sm text-white line-clamp-3">{post.caption}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="mb-2 line-clamp-2 text-sm text-white/70">{post.caption || "Publication Instagram"}</p>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Calendar className="h-3 w-3" />
                    {formatDate(post.timestamp)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <a
            href="https://www.instagram.com/h3_studios_sucy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-black transition-all hover:bg-primary/90"
          >
            <Instagram className="h-5 w-5" />
            Voir toutes les publications
          </a>
        </div>
      </div>
    </div>
  );
}

