import { ScrollUp } from "@/components/common/ScrollUp";
import { ImageCarousel } from "@/components/common/ImageCarousel";

const studios = [
  {
    name: "LA SCÈNE",
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
    name: "LE PODIUM",
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
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <ScrollUp />
      <div className="font-blanka text-3xl md:text-5xl">LES STUDIOS</div>
      <div className="flex w-full flex-col gap-8 lg:max-w-[900px] lg:flex-row">
        {studios.map((studio, i) => (
          <div
            key={i}
            className="flex basis-full flex-col items-center gap-4 border-8 border-primary bg-black p-4 lg:basis-1/2"
          >
            <div className="text-2xl font-bold text-primary underline decoration-4 underline-offset-8">
              {studio.name}
            </div>
            <div className="w-full">
              <div className="aspect-video">
                <ImageCarousel images={studio.images} />
              </div>
            </div>
            <div className="px-0 text-center lg:px-4">{studio.description}</div>
            <div className="mt-auto">
              <a href="/reservation">
                <button className="rounded-[3rem] bg-primary px-8 py-2 text-lg font-semibold text-black">
                  Réservation
                </button>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
