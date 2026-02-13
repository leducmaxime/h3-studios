import { ScrollUp } from "@/components/common/ScrollUp";
import { Star, Quote } from "lucide-react";

const reviews = [
  {
    id: 1,
    author: "Jérémy D",
    rating: 5,
    text: "Super studio! Très bien équipé, propre et acoustiquement parfait. L'équipe est très accueillante. Je recommande vivement!",
    date: "Il y a 2 semaines",
  },
  {
    id: 2,
    author: "Marie L",
    rating: 5,
    text: "Excellent studio de répétition. Le matériel est de qualité et l'espace est très confortable. Parfait pour nos répétitions de groupe.",
    date: "Il y a 1 mois",
  },
  {
    id: 3,
    author: "Thomas B",
    rating: 5,
    text: "Très bon accueil, studios propres et bien insonorisés. Le rapport qualité/prix est excellent. On reviendra!",
    date: "Il y a 1 mois",
  },
  {
    id: 4,
    author: "Sophie M",
    rating: 5,
    text: "Super expérience ! Studio spacieux avec tout le matériel nécessaire. La scène avec éclairage est top pour se mettre en conditions de concert.",
    date: "Il y a 2 mois",
  },
  {
    id: 5,
    author: "Antoine R",
    rating: 5,
    text: "Top pour répéter avec mon groupe. Ambiance sympa et matériel au point. Facile à réserver en ligne.",
    date: "Il y a 2 mois",
  },
  {
    id: 6,
    author: "Camille P",
    rating: 5,
    text: "Je donne des cours de batterie dans ce studio depuis quelques mois. Les conditions sont idéales pour l'enseignement. Je recommande!",
    date: "Il y a 3 mois",
  },
];

const totalReviews = 47;
const averageRating = 4.9;

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
  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <ScrollUp />
      <div className="font-blanka text-3xl md:text-5xl">AVIS CLIENTS</div>

      <div className="w-full max-w-[900px] px-4">
        <div className="mb-8 flex flex-col items-center gap-4 rounded-2xl border-4 border-primary bg-black/80 p-6 text-center">
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
          {reviews.map((review) => (
            <div
              key={review.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
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

        <div className="mt-8 text-center">
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
