import { describe, expect, it } from "vitest";
import { allocateCollectPayments } from "@/lib/recouvrement-collect";

describe("allocateCollectPayments", () => {
  it("fills each booking completely, oldest first, splitting methods when needed", () => {
    const result = allocateCollectPayments(
      [
        { id: "a", remaining: 40 },
        { id: "b", remaining: 35 },
        { id: "c", remaining: 25 },
      ],
      [
        { amount: 80, method: "cash" },
        { amount: 20, method: "check" },
      ],
    );
    expect(result).toEqual([
      { bookingId: "a", amount: 40, method: "cash" },
      { bookingId: "b", amount: 35, method: "cash" },
      { bookingId: "c", amount: 5, method: "cash" },
      { bookingId: "c", amount: 20, method: "check" },
    ]);
  });

  // Remplace l'ancien test « rejects a partial total ».
  // L'acompte était interdit ; il est désormais autorisé (lot 2), le reliquat
  // restant dû sur la dernière réservation servie. L'assertion n'est pas
  // assouplie : elle vérifie maintenant la répartition waterfall exacte.
  it("accepte un acompte et solde les plus anciennes d'abord", () => {
    const result = allocateCollectPayments(
      [
        { id: "a", remaining: 40 },
        { id: "b", remaining: 35 },
      ],
      [{ amount: 50, method: "cash" }],
    );
    // « a » est soldée, « b » reçoit le reliquat de 10 et reste due de 25.
    expect(result).toEqual([
      { bookingId: "a", amount: 40, method: "cash" },
      { bookingId: "b", amount: 10, method: "cash" },
    ]);
  });

  it("n'alloue jamais au-delà du dû d'une réservation", () => {
    const result = allocateCollectPayments(
      [{ id: "a", remaining: 40 }],
      [{ amount: 20, method: "cash" }],
    );
    expect(result).toEqual([{ bookingId: "a", amount: 20, method: "cash" }]);
  });

  // Le sur-paiement reste refusé : un trop-perçu doit passer par un
  // remboursement, jamais être absorbé silencieusement dans une allocation.
  it("refuse un montant supérieur au reste dû", () => {
    expect(
      allocateCollectPayments(
        [{ id: "a", remaining: 40 }],
        [{ amount: 60, method: "cash" }],
      ),
    ).toEqual({ error: "Le montant dépasse le reste dû" });
  });

  it("rejects an empty payment list", () => {
    expect(allocateCollectPayments([{ id: "a", remaining: 10 }], [])).toEqual({
      error: "Ajoutez au moins un paiement",
    });
  });

  it("refuse une collecte sans réservation à encaisser", () => {
    expect(allocateCollectPayments([{ id: "a", remaining: 0 }], [{ amount: 10, method: "cash" }])).toEqual({
      error: "Aucune réservation à encaisser",
    });
  });
});
