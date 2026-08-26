"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Price } from "@/components/common/Price";
import type { TarifsData, TarifsEquipment, TarifsGroupType, TarifsStudio } from "@/lib/tarifs";

/** Ordre d'affichage public, du plus grand au plus petit groupe. */
const GROUP_ORDER: TarifsGroupType[] = ["group", "duo", "solo"];

const GROUP_LABELS: Record<TarifsGroupType, ReactNode> = {
  group: (
    <>
      Groupe <span className="whitespace-nowrap">(3 ou +)</span>
    </>
  ),
  duo: "Duo",
  solo: "Solo et enseignant",
};

/**
 * Une ligne calculée de la grille tarifaire pour un type de groupe donné.
 * - "unique"   : même prix, toutes heures et tous studios confondus → une seule cellule fusionnée.
 * - "byStudio" : pas de distinction heure creuse / heure pleine, mais le prix diffère selon le studio
 *                (ou n'est pas configuré partout) → une ligne, une cellule par studio.
 * - "split"    : heure creuse / heure pleine distinctes → deux lignes, une cellule par studio.
 * `null` dans un tableau de prix signifie « non configuré pour ce studio » (jamais 0 inventé).
 */
type ComputedGridRow =
  | { groupType: TarifsGroupType; variant: "unique"; uniquePrice: number }
  | { groupType: TarifsGroupType; variant: "byStudio"; flatPrices: (number | null)[] }
  | {
      groupType: TarifsGroupType;
      variant: "split";
      offPeakPrices: (number | null)[];
      peakPrices: (number | null)[];
    };

function computeGridRow(groupType: TarifsGroupType, studios: TarifsStudio[]): ComputedGridRow | null {
  const rates = studios.map((s) => s.rates[groupType] ?? null);

  // Aucun studio ne propose ce type de groupe : pas de ligne du tout.
  if (rates.every((r) => r === null)) return null;

  const allFlat = rates.every((r) => r === null || r.offPeak === r.peak);

  if (allFlat) {
    const flatPrices = rates.map((r) => (r === null ? null : r.offPeak));
    const defined = flatPrices.filter((p): p is number => p !== null);
    const allDefined = flatPrices.every((p) => p !== null);
    const allEqual = defined.every((p) => p === defined[0]);

    if (allDefined && allEqual) {
      return { groupType, variant: "unique", uniquePrice: defined[0] };
    }
    return { groupType, variant: "byStudio", flatPrices };
  }

  return {
    groupType,
    variant: "split",
    offPeakPrices: rates.map((r) => (r === null ? null : r.offPeak)),
    peakPrices: rates.map((r) => (r === null ? null : r.peak)),
  };
}

function MissingRate() {
  return <span className="text-sm text-white/40">Non proposé</span>;
}

function GridRow({
  row,
  studios,
  peakStartHour,
}: {
  row: ComputedGridRow;
  studios: TarifsStudio[];
  peakStartHour: number;
}) {
  const label = GROUP_LABELS[row.groupType];

  if (row.variant === "unique") {
    return (
      <TableRow className="hover:bg-black">
        <TableCell className="hidden font-bold lg:table-cell">{label}</TableCell>
        <TableCell>
          <span className="mb-2 block font-bold lg:hidden">
            {label}
            <br />
          </span>
          Tarif unique
        </TableCell>
        <TableCell colSpan={studios.length} className="text-center">
          <Price amount={row.uniquePrice} unit="/Heure" />
        </TableCell>
      </TableRow>
    );
  }

  if (row.variant === "byStudio") {
    return (
      <TableRow className="hover:bg-black">
        <TableCell className="hidden font-bold lg:table-cell">{label}</TableCell>
        <TableCell>
          <span className="mb-2 block font-bold lg:hidden">
            {label}
            <br />
          </span>
          Toutes heures
        </TableCell>
        {row.flatPrices.map((price, i) => (
          <TableCell key={studios[i].studioId} className="text-center">
            {price !== null ? <Price amount={price} unit="/Heure" /> : <MissingRate />}
          </TableCell>
        ))}
      </TableRow>
    );
  }

  return (
    <>
      <TableRow className="hover:bg-black">
        <TableCell rowSpan={2} className="hidden font-bold lg:table-cell">
          {label}
        </TableCell>
        <TableCell>
          <span className="mb-2 block font-bold lg:hidden">
            {label}
            <br />
          </span>
          Avant {peakStartHour}h
        </TableCell>
        {row.offPeakPrices.map((price, i) => (
          <TableCell key={studios[i].studioId} className="text-center">
            {price !== null ? <Price amount={price} unit="/Heure" /> : <MissingRate />}
          </TableCell>
        ))}
      </TableRow>
      <TableRow className="hover:bg-black">
        <TableCell>
          <span className="mb-2 block font-bold lg:hidden">
            {label}
            <br />
          </span>
          <span className="whitespace-nowrap">Après {peakStartHour}h /</span>{" "}
          <span className="whitespace-nowrap">Week-end /</span>{" "}
          <span className="whitespace-nowrap">Jours fériés</span>
        </TableCell>
        {row.peakPrices.map((price, i) => (
          <TableCell key={studios[i].studioId} className="text-center">
            {price !== null ? <Price amount={price} unit="/Heure" /> : <MissingRate />}
          </TableCell>
        ))}
      </TableRow>
    </>
  );
}

/** Vrai si `pricing[i]` (total cumulé pour i+1 unités) croît d'un montant constant depuis l'unité 1. */
function isLinearSessionPricing(pricing: number[]): boolean {
  if (pricing.length === 0) return false;
  const unitPrice = pricing[0];
  return pricing.every((total, i) => total === unitPrice * (i + 1));
}

/**
 * "2ᵉ", "4ᵉ"... (jamais utilisé pour n=1, qui ne peut pas être une unité "offerte").
 * Toujours suivi du mot « unité » à l'affichage : le nom du matériel peut être
 * masculin (« Micro supplémentaire ») ou féminin (« Cymbale »), s'accorder sur
 * « unité » évite un « offert(e) » faux une fois sur deux.
 */
function ordinal(n: number): string {
  return `${n}ᵉ`;
}

function EquipmentPricing({ equipment }: { equipment: TarifsEquipment }) {
  if (equipment.pricingType === "hourly") {
    return (
      <span>
        <Price amount={equipment.pricePerHour} unit="/Heure" />
        {equipment.maxPerSession > 0 && (
          <span className="ml-1.5 text-xs text-white/50">
            (par unité, {equipment.maxPerSession} maximum par séance)
          </span>
        )}
      </span>
    );
  }

  const pricing = equipment.sessionPricing ?? [];
  if (pricing.length === 0) {
    return <span className="text-white/40">—</span>;
  }

  if (isLinearSessionPricing(pricing)) {
    return (
      <span>
        <Price amount={pricing[0]} unit="/séance" />
        {equipment.maxPerSession > 0 && (
          <span className="ml-1.5 text-xs text-white/50">
            (par unité, {equipment.maxPerSession} maximum par séance)
          </span>
        )}
      </span>
    );
  }

  // Barème dégressif ou avec unités offertes : le total cumulé ne suit pas
  // une simple règle par unité, on liste donc chaque palier explicitement.
  return (
    <div className="flex flex-col gap-1">
      {pricing.map((total, i) => {
        const n = i + 1;
        const isFree = i > 0 && total === pricing[i - 1];
        return (
          <div key={n} className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-white/70">
              {n} unité{n > 1 ? "s" : ""} :
            </span>
            <Price amount={total} unit="/séance" />
            {isFree && (
              <span className="text-xs font-semibold text-primary">
                ({ordinal(n)} unité offerte)
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Tarifs({ data }: { data: TarifsData }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const gridRows = GROUP_ORDER.map((groupType) => computeGridRow(groupType, data.studios)).filter(
    (row): row is ComputedGridRow => row !== null
  );

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
              {gridRows.length > 0 ? (
                <Table className="w-full border-2 border-primary bg-black text-center">
                  <TableHeader>
                    <TableRow className="border-primary hover:bg-black">
                      <TableHead className="hidden lg:table-cell"></TableHead>
                      <TableHead></TableHead>
                      {data.studios.map((studio) => (
                        <TableHead key={studio.studioId} className="text-center">
                          Studio <span className="whitespace-nowrap">{studio.studioName}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gridRows.map((row) => (
                      <GridRow
                        key={row.groupType}
                        row={row}
                        studios={data.studios}
                        peakStartHour={data.peakStartHour}
                      />
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-white/60">
                  Nos tarifs sont en cours de mise à jour. Contactez-nous au 06 13 44 08 75.
                </p>
              )}
              <p className="text-sm text-white/60">
                Tous les tarifs sont indiqués TTC. TVA 20%.
              </p>
            </div>
            <span className="text-primary">Abonnement possible sur demande</span>

            <h2 className="text-center font-blanka text-2xl">
              LOCATIONS
            </h2>
            <div className="flex w-full flex-col gap-4">
              {data.equipment.length > 0 ? (
                <Table className="w-full border-2 border-primary bg-black">
                  <TableHeader>
                    <TableRow className="border-primary hover:bg-black">
                      <TableHead>Matériel</TableHead>
                      <TableHead>Tarif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.equipment.map((equipment) => (
                      <TableRow key={equipment.id} className="hover:bg-black">
                        <TableCell className="align-top font-bold">{equipment.name}</TableCell>
                        <TableCell className="align-top">
                          <EquipmentPricing equipment={equipment} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-white/60">Aucune location disponible actuellement.</p>
              )}
            </div>

            <div className={`mt-8 flex flex-col items-center gap-4 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "200ms" }}>
              <a
                href="/reservation"
                className="rounded-lg bg-primary px-8 py-4 text-lg font-bold text-black transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
