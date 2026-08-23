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

  it("rejects a partial total", () => {
    const result = allocateCollectPayments(
      [{ id: "a", remaining: 40 }],
      [{ amount: 20, method: "cash" }],
    );
    expect(result).toEqual({ error: "Le total doit égaler exactement le reste dû" });
  });

  it("rejects an empty payment list", () => {
    expect(allocateCollectPayments([{ id: "a", remaining: 10 }], [])).toEqual({
      error: "Ajoutez au moins un paiement",
    });
  });
});
