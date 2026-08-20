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
import { Price } from "@/components/common/Price";

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
                    <TableCell className="text-center"><Price amount={18} unit="/Heure" /></TableCell>
                    <TableCell className="text-center"><Price amount={15} unit="/Heure" /></TableCell>
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
                    <TableCell className="text-center"><Price amount={22} unit="/Heure" /></TableCell>
                    <TableCell className="text-center"><Price amount={18} unit="/Heure" /></TableCell>
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
                      <Price amount={12} unit="/Heure" />
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
                      <Price amount={6} unit="/Heure" />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-sm text-white/60">
                Tous les tarifs sont indiqués TTC. TVA 20%.
              </p>
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
                      <Price amount={50} unit="/Heure" />
                      <Price amount={170} unit="/Demi-Journée" />
                      <Price amount={320} unit="/Journée" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <span className="font-bold">Locations</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <span>Cymbale crash : <Price amount={1} unit="/Heure" /></span>
                        <span>
                          Micro supplémentaire (5ème ou +) : <Price amount={1} unit="/Heure" />{" "}
                          <span className="text-xs">(plafonné à <Price amount={3} unit="/séance" />)</span>
                        </span>
                        <span>
                          Instruments : <Price amount={2} unit="/Heure" />{" "}
                          <span className="text-xs">(plafonné à <Price amount={5} unit="/séance" />)</span>
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
