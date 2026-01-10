import { ScrollUp } from "@/components/common/ScrollUp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TarifsReservation() {
  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <ScrollUp />
      <div className="text-center font-blanka text-3xl md:text-5xl">
        TARIFS ET RESERVATION
      </div>
      <div className="flex w-full max-w-[1048px] flex-col gap-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex w-full flex-col items-center gap-8 text-center">
            <div className="flex flex-col gap-8 bg-primary px-8 py-4 text-center text-black">
              <div className="w-full text-2xl font-bold underline decoration-4 underline-offset-8">
                RÉSERVATION
              </div>
              <div className="flex flex-col gap-2">
                <p className="whitespace-pre-line font-bold">
                  Prochainement, réservations en ligne !
                </p>
                <p className="whitespace-pre-line">
                  {`En attendant, pour plus d'informations ou pour effectuer une réservation,
n'hésitez pas à contacter notre équipe par e-mail à`}
                </p>
                <a
                  className="whitespace-nowrap text-xl font-semibold"
                  href="mailto:contact@h3-studios.fr?subject=Réservation+d%27un+studio"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  contact@h3-studios.fr
                </a>
                <p>ou à joindre Marcel par téléphone au</p>
                <a
                  className="whitespace-nowrap text-xl font-semibold"
                  href="tel:0613440875"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  06 13 44 08 75
                </a>
              </div>
            </div>

            <div className="text-center font-blanka text-2xl">LES STUDIOS</div>
            <div className="flex w-full flex-col gap-4">
              <Table className="w-full border-8 border-primary text-center">
                <TableHeader>
                  <TableRow className="border-primary">
                    <TableHead className="hidden sm:table-cell"></TableHead>
                    <TableHead></TableHead>
                    <TableHead className="text-center">
                      Studio <span className="whitespace-nowrap">La Scène</span>
                    </TableHead>
                    <TableHead className="text-center">
                      Studio <span className="whitespace-nowrap">Le Podium</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell rowSpan={2} className="hidden font-bold sm:table-cell">
                      Groupe <span className="whitespace-nowrap">(3 ou +)</span>
                    </TableCell>
                    <TableCell>
                      <span className="mb-2 block font-bold sm:hidden">
                        Groupe <span className="whitespace-nowrap">(3 ou +)</span>
                        <br />
                      </span>
                      Avant 18h
                    </TableCell>
                    <TableCell className="text-center">18€/Heure</TableCell>
                    <TableCell className="text-center">15€/Heure</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <span className="mb-2 block font-bold sm:hidden">
                        Groupe <span className="whitespace-nowrap">(3 ou +)</span>
                        <br />
                      </span>
                      <span className="whitespace-nowrap">Après 18h /</span>{" "}
                      <span className="whitespace-nowrap">Week-end /</span>{" "}
                      <span className="whitespace-nowrap">Jours fériés</span>
                    </TableCell>
                    <TableCell className="text-center">22€/Heure</TableCell>
                    <TableCell className="text-center">18€/Heure</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="hidden font-bold sm:table-cell">Duo</TableCell>
                    <TableCell>
                      <span className="mb-2 block font-bold sm:hidden">
                        Duo
                        <br />
                      </span>
                      Tarif unique
                    </TableCell>
                    <TableCell colSpan={2} className="text-center">
                      12€/Heure
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="hidden font-bold sm:table-cell">
                      Solo et enseignant
                    </TableCell>
                    <TableCell>
                      <span className="mb-2 block font-bold sm:hidden">
                        Solo et enseignant
                        <br />
                      </span>
                      Tarif unique
                    </TableCell>
                    <TableCell colSpan={2} className="text-center">
                      6€/Heure
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <span className="text-primary">Abonnement possible sur demande</span>

            <div className="text-center font-blanka text-2xl">
              ENREGISTREMENT ET LOCATIONS
            </div>
            <div className="flex w-full flex-col gap-4">
              <Table className="w-full border-8 border-primary text-center">
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">Prise de son</span>
                        <span>(nous contacter pour le mixage éventuel)</span>
                      </div>
                    </TableCell>
                    <TableCell className="flex flex-col gap-2">
                      <span>50€/Heure</span>
                      <span>170€/Demi-Journée</span>
                      <span>320€/Journée</span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <span className="font-bold">Locations</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <span>Cymbale crash : 1€/Heure</span>
                        <span>
                          Micro supplémentaire (5ème ou +) : 1€/Heure{" "}
                          <span className="text-xs">(plafonné à 3€/séance)</span>
                        </span>
                        <span>
                          Instruments : 2€/Heure{" "}
                          <span className="text-xs">(plafonné à 5€/séance)</span>
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
