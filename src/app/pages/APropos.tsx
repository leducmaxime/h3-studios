import { ScrollUp } from "@/components/common/ScrollUp";
import { Map } from "@/components/common/Map";

export function APropos() {
  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <ScrollUp />
      <div className="font-blanka text-3xl md:text-5xl lg:text-6xl">A PROPOS</div>
      <div className="flex w-full max-w-[1048px] flex-col items-center gap-8 border-8 border-primary bg-black p-4 sm:p-8">
        <div className="flex max-w-screen-md flex-col items-center gap-16 text-center">
          <div className="flex max-w-[640px] flex-col items-center gap-8 text-center">
            <p>
              <span className="font-bold">H3 Studios</span>
              {", situé à 2 minutes à pied de la gare de Sucy-Bonneuil, est un lieu originellement dédié aux répétitions/enregistrements de groupes de musique amplifiée, mais permet aussi, de par son architecture et ses équipements, d'accueillir d'autres activités, culturelles ou non."}
            </p>
            <span className="text-primary">Vous êtes :</span>
            <ul className="flex list-none flex-col gap-2">
              <li>
                {"> Un groupe de musique amplifiée/acoustique, professionnel/amateur, souhaitant répéter, d'enregistrer, se produire dans un lieu adéquat."}
              </li>
              <li>
                {"> Un musicien/enseignant, un formateur cherchant un lieu pour travailler, donner des cours, animer des ateliers, dispenser des formations."}
              </li>
              <li>
                {"> Une personne souhaitant organiser un évènement particulier dans un lieu spacieux et insonorisé."}
              </li>
            </ul>
            <p className="text-2xl font-bold text-primary">
              Un son authentique pour
              <br /> des artistes authentiques !
            </p>
          </div>

          <img
            src="/images/about/bandeau.jpg"
            alt="bandeau"
            className="w-full"
          />

          <div className="flex flex-col items-center gap-8 text-center">
            <div className="text-2xl font-bold text-primary underline decoration-4 underline-offset-8">
              CONTACT
            </div>
            <div>contact@h3-studios.fr - 06 13 44 08 75</div>
          </div>

          <div className="flex w-full flex-col items-center gap-8 text-center">
            <div className="text-2xl font-bold text-primary underline decoration-4 underline-offset-8">
              LOCALISATION
            </div>
            <div className="flex w-full flex-col items-center gap-8 lg:flex-row">
              <div className="flex w-full flex-col gap-8 lg:basis-1/2">
                <p className="whitespace-pre-line underline hover:font-bold">
                  <a
                    href="https://maps.app.goo.gl/STjxqLmfUnL6mEMY9"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {`3 Rue de la Grande Ceinture
94370 Sucy-en-Brie`}
                  </a>
                </p>
                <p className="whitespace-pre-line">
                  {`En transport en commun : 
Gare de Sucy-Bonneuil à 2min à pied
RER A - BUS 393 - BUS 308 - BUS 104`}
                </p>
                <p className="whitespace-pre-line">
                  {`En voiture : 
Stationnement gratuit dans la rue`}
                </p>
              </div>
              <div className="w-full lg:basis-1/2">
                <Map />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
