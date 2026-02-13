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
  {
    name: "Caroline",
    role: "Co-gérante",
    image: "/images/team/caroline.jpg",
    bio: `C'est en passionnée de musique que Caroline a rejoint l'aventure H3 Studios. Elle la pratique en tant qu'amatrice en chantant dans plusieurs groupes et chorales.

Fan de pop-rock, elle souhaite renouer prochainement avec son amour de jeunesse, la basse.

Caroline, c'est LA touche féminine de ce trio !`,
  },
  {
    name: "Alexandre",
    role: "Co-gérant",
    image: "/images/team/alexandre.jpg",
    bio: `Alexandre baigne dans la musique depuis son plus jeune âge et, jusqu'à l'âge adulte, s'est essayé à plusieurs instruments, du violon à la guitare en passant par le piano et les percussions.

Mais pour que la musique reste toujours un plaisir, il a décidé de ne pas en faire son métier et de s'orienter dans l'informatique : il est actuellement en poste chez un leader européen du numérique.

Ces dernières années l'ont vu franchir le pas sur la pratique d'un instrument qui l'avait toujours fasciné, le saxophone, le ténor en particulier. Ses progrès constants lui ont donné l'occasion d'intégrer un groupe local de funk, les Pink Elefunk, ainsi qu'un atelier de jazz lui permettant d'exprimer sa créativité.

Le projet H3 Studios est une occasion unique de faire de la musique une part plus importante de sa vie, en permettant aux autres de pouvoir également exprimer cette passion qu'ils ont en commun.`,
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

      <div className="w-full max-w-6xl px-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {team.map((member, i) => (
          <div
            key={i}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-primary/50"
          >
            <div className="flex flex-col items-center p-6 text-center">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-primary/30">
                <img
                  src={member.image}
                  alt={member.name}
                  className="h-full w-full object-cover"
                />
              </div>
              
              <h2 className="mt-4 text-xl font-bold text-primary">
                {member.name}
              </h2>
              <p className="mt-1 text-white/60">{member.role}</p>
              
              <div className="mt-4 flex-1 space-y-3 text-sm text-white/70 leading-relaxed">
                {member.bio.split('\n\n').map((paragraph, j) => (
                  <p key={j}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-4xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-6 text-white/50">
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
