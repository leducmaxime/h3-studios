"use client";

import { useState, useEffect } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function Tarifs() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-16 pt-32">
      <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
        <h1 className="font-blanka text-4xl lg:text-6xl">
          TARIFS
        </h1>
        <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>

      <div className={`mt-4 flex w-full max-w-[1048px] sm:max-w-[640px] lg:max-w-[1048px] flex-col gap-8 px-2 lg:px-4 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "100ms" }}>
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex w-full flex-col items-center gap-8 text-center">
            <h2 className="text-center font-blanka text-2xl">GRILLE TARIFAIRE</h2>
            <div className="flex w-full flex-col gap-4">
              <Table className="w-full border-8 border-primary text-center">
                <TableHeader>
                  <TableRow className="border-primary">
                    <TableHead className="hidden lg:table-cell"></TableHead>
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
                    <TableCell rowSpan={2} className="hidden font-bold lg:table-cell">
                      Groupe <span className="whitespace-nowrap">(3 ou +)</span>
                    </TableCell>
                    <TableCell>
                      <span className="mb-2 block font-bold lg:hidden">
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
                      <span className="mb-2 block font-bold lg:hidden">
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
                    <TableCell className="hidden font-bold lg:table-cell">Duo</TableCell>
                    <TableCell>
                      <span className="mb-2 block font-bold lg:hidden">
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
                    <TableCell className="hidden font-bold lg:table-cell">
                      Solo et enseignant
                    </TableCell>
                    <TableCell>
                      <span className="mb-2 block font-bold lg:hidden">
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

            <h2 className="text-center font-blanka text-2xl">
              ENREGISTREMENT ET LOCATIONS
            </h2>
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

            <div className={`mt-8 flex flex-col items-center gap-4 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "200ms" }}>
              <a
                href="/reservation"
                className="rounded-lg bg-primary px-8 py-4 text-lg font-bold text-black transition-colors hover:bg-primary/90"
              >
                Réserver un créneau
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
