import { ScrollUp } from "@/components/common/ScrollUp";
import { ImageCarousel } from "@/components/common/ImageCarousel";
import { Wifi, TrainFront, MapPin, Music, Calendar, Clock } from "lucide-react";

const studios = [
  {
    name: "La Scène",
    size: "42m²",
    height: "3,50m",
    description:
      "Avec une hauteur de 3,50m et une superficie de 42m², notre studio propose une scène intimiste avec sa rampe d'éclairage. Convenant à tous styles musicaux, ce lieu chaleureux et fonctionnel saura répondre à vos besoins.",
    images: [
      { src: "/images/studios/scene-2.jpg", alt: "La Scène 1" },
      { src: "/images/studios/scene-5.jpg", alt: "La Scène 2" },
      { src: "/images/studios/scene-3.jpg", alt: "La Scène 3" },
      { src: "/images/studios/scene-1.jpg", alt: "La Scène 4" },
      { src: "/images/studios/scene-4.jpg", alt: "La Scène 5" },
    ],
  },
  {
    name: "Le Podium",
    size: "35m²",
    height: "2,80m",
    description:
      "Conçu pour la répétition, cet espace de 35m² offre un cadre simple et fonctionnel, idéal pour vos sessions musicales, en groupe ou en solo. Cette salle est également adapté aux enseignants souhaitant donner des cours à un ou plusieurs élèves.",
    images: [
      { src: "/images/studios/podium-2.jpg", alt: "Le Podium 1" },
      { src: "/images/studios/podium-1.jpg", alt: "Le Podium 2" },
      { src: "/images/studios/podium-3.jpg", alt: "Le Podium 3" },
      { src: "/images/studios/podium-4.jpg", alt: "Le Podium 4" },
    ],
  },
];

export function LesStudios() {
  return (
    <div className="flex min-h-fit grow flex-col items-center gap-12 pb-16 pt-32">
      <ScrollUp />

      <div className="w-full max-w-5xl px-4">
        <div className="mb-8 text-center">
          <h1 className="font-blanka text-4xl md:text-5xl lg:text-6xl">LES STUDIOS</h1>
          <p className="mt-4 text-lg text-white/60">
            Deux espaces uniques pour vos répétitions et enregistrements
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/50">
          <span className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" />
            Wifi gratuit
          </span>
          <span className="flex items-center gap-2">
            <TrainFront className="h-4 w-4 text-primary" />
            2 min du RER A
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            20 min de Paris
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/50">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Ouvert 7j/7
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Uniquement sur réservation
          </span>
        </div>
      </div>

      <div className="w-full max-w-6xl px-4 grid gap-6 lg:grid-cols-2">
        {studios.map((studio, i) => (
          <div
            key={i}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-primary/50"
          >
            <div className="relative aspect-video">
              <ImageCarousel images={studio.images} />
            </div>
            
            <div className="flex flex-1 flex-col justify-between p-6">
              <div>
                <h2 className="text-2xl font-bold text-primary">
                  {studio.name}
                </h2>
                <p className="mt-1 text-white/60">
                  {studio.size} • Hauteur {studio.height}
                </p>

                <p className="mb-4 mt-4 text-white/70 leading-relaxed text-sm">
                  {studio.description}
                </p>
              </div>

              <div className="mt-6 text-center">
                <a
                  href="/reservation"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-black transition-all hover:bg-primary/90"
                >
                  <Music className="h-4 w-4" />
                  Réserver
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
