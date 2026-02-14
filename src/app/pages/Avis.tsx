"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { Star, Quote } from "lucide-react";
import { useState, useEffect } from "react";

const reviews = [
  {
    id: 1,
    author: "Mardochée D.",
    rating: 5,
    text: "Le studio est très bien situé, l'équipement est de qualité, et c'est toujours un réel plaisir de répéter au Studio H3. En plus, le gérant et toute l'équipe sont géniaux : accueillants, professionnels et à l'écoute. Je recommande vivement 🙏🏽",
    date: "Il y a 1 mois",
  },
  {
    id: 2,
    author: "Gams G.",
    rating: 5,
    text: "Studio de répétition très très sympa comme ses gérants. Toujours disponible et dont le prix est vraiment très intéressant par rapport aux autres studios. Mille merci à eux et je recommande à tous les musiciens, groupes, chorales...",
    date: "Il y a 1 mois",
  },
  {
    id: 3,
    author: "Pascal G.",
    rating: 5,
    text: "Un super studio de répétition. Le grand studio a une très bonne acoustique, et Marcel le gérant en plus d'être adorable et à l'écoute de nos besoins, fait toujours des balances impeccables !",
    date: "Il y a 1 mois",
  },
  {
    id: 4,
    author: "Fab F.",
    rating: 5,
    text: "Bien situé, facile d'accès (à deux pas de la station RER A), H3 Studios offre des espaces confortables avec équipements pro pour des séances de répétitions ou d'enregistrement agréables. Rapport qualité prix au top !",
    date: "Il y a 1 mois",
  },
  {
    id: 5,
    author: "Linda S.",
    rating: 5,
    text: "Toujours un plaisir de venir répéter chez H3 Studios ! L'équipe est au top, toujours de très bons conseils, dans une ambiance à la fois pro et super conviviale. On s'y sent comme en famille. Merci Marcel !",
    date: "Il y a 1 mois",
  },
];

const totalReviews = 5;
const averageRating = 5;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 ${
            star <= rating ? "fill-primary text-primary" : "text-white/30"
          }`}
        />
      ))}
    </div>
  );
}

export function Avis() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <ScrollUp />
      <div className={`font-blanka text-3xl md:text-5xl transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>AVIS CLIENTS</div>

      <div className="w-full max-w-[900px] px-4">
        <div className={`mb-8 flex flex-col items-center gap-4 rounded-2xl border-4 border-primary bg-black/80 p-6 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "100ms" }}>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-primary">{averageRating}</span>
            <div className="flex flex-col items-start gap-1">
              <StarRating rating={5} />
              <span className="text-sm text-white/60">
                Basé sur {totalReviews} avis Google
              </span>
            </div>
          </div>
          <a
            href="https://www.google.com/search?q=H3+studios+sucy+en+brie+avis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline hover:text-primary/80"
          >
            Voir tous les avis sur Google
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className={`flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              style={{ transitionDelay: `${200 + index * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary">
                    {review.author.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{review.author}</span>
                    <span className="text-xs text-white/50">{review.date}</span>
                  </div>
                </div>
              </div>
              <StarRating rating={review.rating} />
              <p className="text-sm text-white/80 leading-relaxed">
                "{review.text}"
              </p>
            </div>
          ))}
        </div>

        <div className={`mt-8 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "800ms" }}>
          <a
            href="https://www.google.com/search?q=H3+studios+sucy+en+brie+avis"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-black transition-colors hover:bg-primary/90"
          >
            Voir tous les avis sur Google
          </a>
        </div>
      </div>
    </div>
  );
}
