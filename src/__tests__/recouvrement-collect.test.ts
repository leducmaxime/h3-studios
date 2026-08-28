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

  it("accepte un sur-paiement et laisse l'excedent non affecte", () => {
    const result = allocateCollectPayments(
      [{ id: "a", remaining: 40 }],
      [{ amount: 60, method: "cash" }],
    );
    // 40 € sont affectés, 20 € restent non affectés : aucune réservation n'est sur-allouée.
    expect(result).toEqual([{ bookingId: "a", amount: 40, method: "cash" }]);
  });

  it("répartit le sur-paiement multi-méthodes sur la dernière méthode", () => {
    const result = allocateCollectPayments(
      [
        { id: "a", remaining: 120 },
        { id: "b", remaining: 80 },
      ],
      [
        { amount: 150, method: "cash" },
        { amount: 100, method: "check" },
      ],
    );
    // 200 € dus sont affectés ; les 50 € excédentaires du chèque restent non affectés.
    expect(result).toEqual([
      { bookingId: "a", amount: 120, method: "cash" },
      { bookingId: "b", amount: 30, method: "cash" },
      { bookingId: "b", amount: 50, method: "check" },
    ]);
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
