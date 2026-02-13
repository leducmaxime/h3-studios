import { ScrollUp } from "@/components/common/ScrollUp";
import { Map } from "@/components/common/Map";
import { Mail, Phone, MapPin, Train, Car, Music, GraduationCap, Calendar } from "lucide-react";

export function APropos() {
  return (
    <div className="flex min-h-fit grow flex-col items-center gap-12 pb-16 pt-32">
      <ScrollUp />

      <div className="w-full max-w-5xl px-4">
        <div className="mb-8 text-center">
          <h1 className="font-blanka text-4xl md:text-5xl lg:text-6xl">À PROPOS</h1>
          <p className="mt-4 text-lg text-white/60">
            Un son authentique pour des artistes authentiques
          </p>
        </div>
      </div>

      <div className="w-full max-w-5xl px-4 space-y-6">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="relative aspect-[21/9]">
            <img
              src="/images/about/bandeau.jpg"
              alt="H3 Studios"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          
          <div className="p-6 lg:p-8">
            <p className="text-lg text-white/80 leading-relaxed">
              <span className="font-bold text-primary">H3 Studios</span>
              {" }, situé à 2 minutes à pied de la gare de Sucy-Bonneuil, est un lieu originellement dédié aux répétitions et enregistrements de groupes de musique amplifiée, mais permet aussi, de par son architecture et ses équipements, d'accueillir d'autres activités, culturelles ou non."}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:border-primary/50">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Groupes</h3>
            <p className="mt-2 text-sm text-white/70">
              Musique amplifiée ou acoustique, professionnel ou amateur, pour répéter, enregistrer ou se produire.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:border-primary/50">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Enseignants</h3>
            <p className="mt-2 text-sm text-white/70">
              Musiciens, formateurs cherchant un lieu pour donner des cours, animer des ateliers ou dispenser des formations.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:border-primary/50">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Évènements</h3>
            <p className="mt-2 text-sm text-white/70">
              Organisation d'évènements particuliers dans un lieu spacieux et insonorisé.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 lg:p-8">
            <h2 className="mb-6 text-xl font-bold text-primary">Contact</h2>
            <div className="space-y-4">
              <a
                href="mailto:contact@h3-studios.fr"
                className="flex items-center gap-3 text-white/70 transition-colors hover:text-primary"
              >
                <Mail className="h-5 w-5 text-primary" />
                <span>contact@h3-studios.fr</span>
              </a>
              <a
                href="tel:+33613440875"
                className="flex items-center gap-3 text-white/70 transition-colors hover:text-primary"
              >
                <Phone className="h-5 w-5 text-primary" />
                <span>06 13 44 08 75</span>
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 lg:p-8">
            <h2 className="mb-6 text-xl font-bold text-primary">Localisation</h2>
            <div className="space-y-4">
              <a
                href="https://maps.app.goo.gl/STjxqLmfUnL6mEMY9"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 text-white/70 transition-colors hover:text-primary"
              >
                <MapPin className="h-5 w-5 flex-shrink-0 text-primary" />
                <span>3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie</span>
              </a>
              <div className="flex items-start gap-3 text-white/70">
                <Train className="h-5 w-5 flex-shrink-0 text-primary" />
                <span>Gare de Sucy-Bonneuil à 2 min • RER A • BUS 393, 308, 104</span>
              </div>
              <div className="flex items-start gap-3 text-white/70">
                <Car className="h-5 w-5 flex-shrink-0 text-primary" />
                <span>Stationnement gratuit dans la rue</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="aspect-video w-full">
            <Map />
          </div>
        </div>
      </div>
    </div>
  );
}
