"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { useEffect, useState } from "react";

const team = [
  {
    name: "Marcel",
    role: "Gérant",
    image: "/images/about/marcel.png",
    bio: `Musicien passionné depuis toujours : violon, piano, basse, batterie, percussions d'orchestre… Il a fait de la musique son métier !

Il est professeur de percussions en conservatoire depuis 30 ans, ainsi que de MAO (Musique Assistée par Ordinateur) et chef adjoint d'un orchestre d'Harmonie.

Marcel a joué durant 25 ans dans un orchestre symphonique et s'est lancé dans la musique à l'image. Anecdote : si vous allez au Grand Rex à Paris, vous pourrez même entendre l'une de ses compositions !`,
  },
  {
    name: "Caroline",
    role: "Co-gérante",
    image: "/images/about/caro.png",
    bio: `C'est en passionnée de musique que Caroline a rejoint l'aventure H3 Studios. Elle la pratique en tant qu'amatrice en chantant dans plusieurs groupes et chorales.

Fan de pop-rock, elle souhaite renouer prochainement avec son amour de jeunesse, la basse.

Caroline, c'est LA touche féminine de ce trio !`,
  },
  {
    name: "Alexandre",
    role: "Co-gérant",
    image: "/images/about/alex.png",
    bio: `Alexandre baigne dans la musique depuis son plus jeune âge et s'est essayé à plusieurs instruments, du violon à la guitare en passant par le piano et les percussions.

Il a décidé de ne pas en faire son métier et s'orienter dans l'informatique. Ces dernières années l'ont vu franchir le pas sur le saxophone ténor. Il a intégré un groupe de funk, les Pink Elefunk, ainsi qu'un atelier de jazz.`,
  },
];

export function Equipe() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center pb-20 pt-32">
      <ScrollUp />

      <div className="relative w-full px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h1 className="font-blanka text-5xl md:text-6xl lg:text-7xl">L'ÉQUIPE</h1>
            <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
            <p className="mt-6 text-lg text-white/60">
              Les passionnés qui font vivre H3 Studios
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {team.map((member, i) => (
              <div
                key={member.name}
                className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent transition-all duration-700 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(249,176,53,0.15)] ${
                  isVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="relative h-80 w-full overflow-hidden">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h2 className="text-2xl font-bold text-primary">
                      {member.name}
                    </h2>
                    <p className="text-sm text-white/70">{member.role}</p>
                  </div>
                  <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-primary/20 blur-2xl transition-all duration-500 group-hover:bg-primary/40 group-hover:blur-3xl" />
                </div>

                <div className="p-6">
                  <div className="space-y-3 text-sm text-white/70 leading-relaxed">
                    {member.bio.split("\n\n").map((paragraph, j) => (
                      <p key={j}>{paragraph}</p>
                    ))}
                  </div>
                </div>

                <div className="absolute -bottom-1 left-4 h-3 w-3 rounded-full bg-primary opacity-0 transition-all duration-500 group-hover:opacity-100" />
                <div className="absolute -bottom-1 right-4 h-3 w-3 rounded-full bg-primary opacity-0 transition-all duration-500 delay-75 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
