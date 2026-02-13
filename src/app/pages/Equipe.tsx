import { ScrollUp } from "@/components/common/ScrollUp";
import { Music, Mic, Drum } from "lucide-react";

const team = [
  {
    name: "Marcel",
    role: "Gérant",
    image: "/images/team/marcel.jpg",
    bio: `Musicien passionné depuis toujours : violon, piano, basse, batterie, percussions d'orchestre… Il a fait de la musique son métier !

Il est professeur de percussions en conservatoire depuis 30 ans, ainsi que de MAO (Musique Assistée par Ordinateur) et chef adjoint d'un orchestre d'Harmonie. Il a également été professeur de MAA (Musiques Amplifiées Actuelles).

Marcel a joué durant 25 ans dans un orchestre symphonique, réalisé de nombreux arrangements pour tout type d'ensembles (notamment symphoniques), et s'est lancé depuis quelques années dans la musique à l'image.

Anecdote : si vous allez au Grand Rex à Paris, vous pourrez même entendre l'une de ses compositions en salle !

Depuis 3 ans, il est gérant des studios, tout en restant actif sur scène comme batteur, bassiste, et comme pianiste/percussionniste (@Triba Mondo).

Chez H3 Studios, Marcel est celui qui a dédié toute sa vie à la musique, c'est l'expertise musicale incarnée du studio.`,
  },
];

export function Equipe() {
  return (
    <div className="flex min-h-fit grow flex-col items-center gap-12 pb-16 pt-32">
      <ScrollUp />

      <div className="w-full max-w-4xl px-4">
        <div className="mb-8 text-center">
          <h1 className="font-blanka text-4xl md:text-5xl lg:text-6xl">L'ÉQUIPE</h1>
          <p className="mt-4 text-lg text-white/60">
            Les passionnés qui font vivre H3 Studios
          </p>
        </div>
      </div>

      <div className="w-full max-w-4xl px-4 space-y-12">
        {team.map((member, i) => (
          <div
            key={i}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-primary/50"
          >
            <div className="flex flex-col gap-6 p-6 md:flex-row md:gap-8 md:p-8">
              <div className="flex-shrink-0">
                <div className="mx-auto h-40 w-40 overflow-hidden rounded-full border-4 border-primary/30 md:mx-0">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-primary md:text-3xl">
                  {member.name}
                </h2>
                <p className="mt-1 text-lg text-white/60">{member.role}</p>
                
                <div className="mt-4 space-y-4 text-white/70 leading-relaxed">
                  {member.bio.split('\n\n').map((paragraph, j) => (
                    <p key={j}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-4xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-8 text-white/40">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <span>Passion</span>
          </div>
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            <span>Expertise</span>
          </div>
          <div className="flex items-center gap-2">
            <Drum className="h-5 w-5 text-primary" />
            <span>Expérience</span>
          </div>
        </div>
      </div>
    </div>
  );
}
