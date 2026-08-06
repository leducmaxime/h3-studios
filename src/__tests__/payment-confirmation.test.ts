import { describe, it, expect } from "vitest";
import {
  isSessionPaid,
  computeExpectedTotalCents,
  computeAmountMismatchCents,
  partitionBookingsForFinalization,
  buildPaidConfirmationEmailPayload,
  finalizePaidCheckoutSession,
  type FinalizePaidSessionDeps,
} from "@/lib/payment-confirmation";
import type { DbBooking } from "@/lib/db-types";
import type { BookingConfirmationData } from "@/lib/email";

type BookingLike = DbBooking;

function makeBooking(overrides: Partial<BookingLike>): BookingLike {
  return {
    id: "b-" + (overrides.booking_ref || "x"),
    booking_ref: "ref-x",
    user_id: "u1",
    band_name: null,
    studio_id: "la-scene",
    date: "2026-01-05",
    start_time: "18:00",
    end_time: "20:00",
    group_type: "group",
    status: "confirmed",
    base_price: 0,
    equipment_price: 0,
    total_price: 0,
    equipment: null,
    payment_method: "card",
    payment_status: "pending",
    notes: null,
    round_mode: "none",
    round_value: null,
    promo_code: null,
    promo_discount: 0,
    promo_type: null,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
    cancelled_at: null,
    cancel_reason: null,
    user_name: null,
    user_email: null,
    user_band_name: null,
    user_phone: null,
    ...overrides,
  };
}

const USER = { name: "Jean Dupont", email: "jean@example.fr", phone: "0612345678" };

interface FakeState {
  bookings: BookingLike[];
  payments: Array<{ booking_id: string; amount: number; stripe_event_id: string | null }>;
  audits: Array<{ entityType: string; entityId: string; action: string; changes: Record<string, unknown> }>;
  claimed: boolean;
  emailClaimed: boolean;
  emailSentAt: string | null;
  sentPayloads: BookingConfirmationData[];
}

function makeDeps(overrides: Partial<FinalizePaidSessionDeps> = {}) {
  const state: FakeState = {
    bookings: [],
    payments: [],
    audits: [],
    claimed: false,
    emailClaimed: false,
    emailSentAt: null,
    sentPayloads: [],
  };

  const deps: FinalizePaidSessionDeps = {
    getBookingsByRef: async (refs) => state.bookings.filter((b) => refs.includes(b.booking_ref)),
    // Idempotent par (booking_id, stripe_event_id) — émule INSERT OR IGNORE.
    completePayment: async (data) => {
      const already = state.payments.some(
        (p) => p.booking_id === data.booking_id && p.stripe_event_id === data.stripe_event_id,
      );
      if (already) return { inserted: false };
      state.payments.push({ booking_id: data.booking_id, amount: data.amount, stripe_event_id: data.stripe_event_id ?? null });
      return { inserted: true };
    },
    addAuditLog: async (entityType, entityId, action, changes) => {
      state.audits.push({ entityType, entityId, action, changes });
    },
    claimConfirmation: async () => {
      if (state.claimed) return { inserted: false };
      state.claimed = true;
      return { inserted: true };
    },
    getConfirmation: async () => ({ email_sent_at: state.emailSentAt }),
    // Claim atomique émulé : un seul gagne (emailClaimed).
    claimEmail: async () => {
      if (state.emailClaimed) return { claimed: false, claimedAt: "" };
      state.emailClaimed = true;
      state.emailSentAt = new Date().toISOString();
      return { claimed: true, claimedAt: state.emailSentAt };
    },
    releaseEmailClaim: async (_sessionId, claimedAt) => {
      if (state.emailSentAt === claimedAt) {
        state.emailClaimed = false;
        state.emailSentAt = null;
      }
    },
    getUserById: async () => USER,
    sendEmail: async (data) => {
      state.sentPayloads.push(data);
      return { success: true };
    },
    nowISO: () => "2026-01-05 12:00:00",
    ...overrides,
  };

  return { deps, state };
}

const paidSession = { id: "cs_test_1", amount_total: 2800, payment_status: "paid" as const };
const unpaidSession = { id: "cs_test_2", amount_total: 2800, payment_status: "unpaid" as const };

describe("isSessionPaid / guards", () => {
  it("accepts only payment_status === 'paid'", () => {
    expect(isSessionPaid({ payment_status: "paid" })).toBe(true);
    expect(isSessionPaid({ payment_status: "unpaid" })).toBe(false);
    expect(isSessionPaid({ payment_status: "no_payment_required" })).toBe(false);
  });

  it("computes expected total in cents (net of each line's discount)", () => {
    const bookings = [
      makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 20 }),
      makeBooking({ booking_ref: "b", base_price: 30, equipment_price: 0, total_price: 30, promo_discount: 5 }),
    ];
    expect(computeExpectedTotalCents(bookings)).toBe(2800); // (23-20)*100 + (30-5)*100
  });

  it("reports the Stripe vs DB amount mismatch in cents", () => {
    expect(computeAmountMismatchCents({ amount_total: 3000 }, 2800)).toBe(200);
    expect(computeAmountMismatchCents({ amount_total: 2800 }, 2800)).toBe(0);
    expect(computeAmountMismatchCents({ amount_total: null }, 2800)).toBeNull();
  });

  it("partitions cancelled bookings out of finalization (expired-then-paid)", () => {
    const bookings = [
      makeBooking({ booking_ref: "a", status: "confirmed" }),
      makeBooking({ booking_ref: "b", status: "cancelled" }),
    ];
    const { finalizable, cancelled } = partitionBookingsForFinalization(bookings);
    expect(finalizable.map((b) => b.booking_ref)).toEqual(["a"]);
    expect(cancelled.map((b) => b.booking_ref)).toEqual(["b"]);
  });
});

describe("buildPaidConfirmationEmailPayload (aggregate promo math)", () => {
  it("sums the cart's promo_discount allocations (not firstBooking only)", () => {
    const bookings = [
      makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 20, promo_code: "ROCK2026", promo_type: "percentage" }),
      makeBooking({ booking_ref: "b", base_price: 30, equipment_price: 0, total_price: 30, promo_discount: 5, promo_code: "ROCK2026", promo_type: "percentage" }),
    ];
    const payload = buildPaidConfirmationEmailPayload({ bookings, user: USER });
    expect(payload.promoDiscount).toBe(25);
    expect(payload.promoCode).toBe("ROCK2026");
    expect(payload.totalPrice).toBe(28); // brut 53 − réduction aggregée 25
    expect(payload.allSlots).toHaveLength(2);
    expect(payload.allSlots![0].totalPrice).toBe(23);
    expect(payload.allSlots![1].totalPrice).toBe(30);
  });

  it("handles a single-booking cart", () => {
    const bookings = [
      makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 20 }),
    ];
    const payload = buildPaidConfirmationEmailPayload({ bookings, user: USER });
    expect(payload.promoDiscount).toBe(20);
    expect(payload.totalPrice).toBe(3);
    expect(payload.allSlots).toBeUndefined();
  });
});

describe("finalizePaidCheckoutSession", () => {
  it("never finalizes an unpaid session (paid-status guard)", async () => {
    const { deps, state } = makeDeps();
    state.bookings = [makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 0 })];
    const outcome = await finalizePaidCheckoutSession(unpaidSession, ["a"], deps);
    expect(outcome.status).toBe("not-paid");
    expect(state.payments).toHaveLength(0);
    expect(state.sentPayloads).toHaveLength(0);
    expect(state.claimed).toBe(false);
  });

  it("finalizes once and is idempotent on duplicate/retry calls", async () => {
    const { deps, state } = makeDeps();
    state.bookings = [
      makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 0, status: "confirmed" }),
      makeBooking({ booking_ref: "b", base_price: 30, equipment_price: 0, total_price: 30, promo_discount: 5, status: "confirmed" }),
    ];

    const first = await finalizePaidCheckoutSession(paidSession, ["a", "b"], deps);
    expect(first.status).toBe("finalized");
    expect(state.payments).toHaveLength(2);
    expect(state.sentPayloads).toHaveLength(1);

    // Duplicate (webhook replay + session lookup) → déjà traité, rien de refait.
    const second = await finalizePaidCheckoutSession(paidSession, ["a", "b"], deps);
    expect(second.status).toBe("already-finalized");
    expect(state.payments).toHaveLength(2);
    expect(state.sentPayloads).toHaveLength(1);
  });

  it("retries the email when the first send failed (claim released)", async () => {
    const { deps, state } = makeDeps({
      sendEmail: async (data) => {
        state.sentPayloads.push(data);
        return { success: state.sentPayloads.length > 1 }; // 1er échec, 2e succès
      },
    });
    state.bookings = [makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 0, status: "confirmed" })];

    const first = await finalizePaidCheckoutSession(paidSession, ["a"], deps);
    expect(first.status).toBe("finalized");
    if (first.status === "finalized") expect(first.emailSent).toBe(false);
    expect(state.emailSentAt).toBeNull(); // claim libéré après échec

    const retry = await finalizePaidCheckoutSession(paidSession, ["a"], deps);
    expect(retry.status).toBe("finalized");
    if (retry.status === "finalized") {
      expect(retry.paymentsAdded).toBe(0); // pas de re-ajout de paiement
      expect(retry.emailSent).toBe(true);
    }
    expect(state.payments).toHaveLength(1);
    expect(state.sentPayloads).toHaveLength(2);
  });

  it("never reinstates a cancelled (expired) booking — audit instead", async () => {
    const { deps, state } = makeDeps();
    state.bookings = [
      makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 0, status: "cancelled" }),
      makeBooking({ booking_ref: "b", base_price: 30, equipment_price: 0, total_price: 30, promo_discount: 0, status: "confirmed" }),
    ];

    const outcome = await finalizePaidCheckoutSession(paidSession, ["a", "b"], deps);
    expect(outcome.status).toBe("finalized");
    if (outcome.status === "finalized") expect(outcome.cancelledSkipped).toBe(1);
    expect(state.payments.map((p) => p.booking_id)).toEqual(["b-b"]);
    const lateAudit = state.audits.find((a) => a.action === "late-payment-cancelled");
    expect(lateAudit).toBeDefined();
    expect(lateAudit!.entityId).toBe("b-a");
    expect(state.sentPayloads).toHaveLength(1);
  });

  it("audits Stripe vs DB amount mismatch once, by the session owner (M3)", async () => {
    const { deps, state } = makeDeps();
    state.bookings = [makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 0, status: "confirmed" })];
    const mismatchSession = { id: "cs_test_m", amount_total: 3000, payment_status: "paid" as const };

    const first = await finalizePaidCheckoutSession(mismatchSession, ["a"], deps);
    expect(first.status).toBe("finalized");

    // Retry après finalisation complète → pas de nouvel audit.
    const second = await finalizePaidCheckoutSession(mismatchSession, ["a"], deps);
    expect(second.status).toBe("already-finalized");

    const mismatchAudits = state.audits.filter((a) => a.action === "amount-mismatch");
    expect(mismatchAudits).toHaveLength(1);
    expect(mismatchAudits[0].changes.diffCents).toBe(3000 - 2300);
  });
});

describe("M1 — concurrent email delivery is claimed atomically (single send)", () => {
  it("owner + concurrent recovery only sends one email", async () => {
    const { deps, state } = makeDeps();

    // Bloque l'envoi du webhook (owner) pour permettre l'interleaving avec la
    // récupération (session lookup) qui arrive pendant que l'email est en vol.
    let releaseSend: () => void = () => {};
    const sendGate = new Promise<void>((resolve) => { releaseSend = resolve; });
    const origSend = deps.sendEmail;
    deps.sendEmail = async (data) => {
      state.sentPayloads.push(data);
      await sendGate; // le webhook est bloqué dans l'envoi
      return { success: true };
    };

    state.bookings = [
      makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 0, status: "confirmed" }),
    ];

    // Webhook (owner) — lance et bloque dans sendEmail.
    const ownerPromise = finalizePaidCheckoutSession(paidSession, ["a"], deps);

    // Attend que le webhook ait claimé l'email (email_sent_at posé) et soit
    // bloqué dans sendEmail — interleaving déterministe.
    const deadline = Date.now() + 1000;
    while (!state.emailClaimed && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(state.emailClaimed).toBe(true);

    // Récupération concurrente — l'email est déjà claimé (email_sent_at non null)
    // → early-return "already-finalized", aucun second envoi.
    const recovery = await finalizePaidCheckoutSession(paidSession, ["a"], deps);
    expect(recovery.status).toBe("already-finalized");

    // Laisse l'owner finir son envoi.
    releaseSend();
    const owner = await ownerPromise;
    expect(owner.status).toBe("finalized");
    if (owner.status === "finalized") expect(owner.emailSent).toBe(true);

    expect(state.sentPayloads).toHaveLength(1);
  });

  it("a retry after a released claim can re-send, but never concurrently", async () => {
    const { deps, state } = makeDeps();
    let sendCalls = 0;
    const origClaim = deps.claimEmail;
    deps.claimEmail = async (sessionId) => {
      const claim = await origClaim(sessionId);
      return claim;
    };
    deps.sendEmail = async (data) => {
      sendCalls++;
      state.sentPayloads.push(data);
      return { success: sendCalls === 1 ? false : true }; // 1er échec
    };

    state.bookings = [makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 0, status: "confirmed" })];

    await finalizePaidCheckoutSession(paidSession, ["a"], deps); // échec → claim libéré
    await finalizePaidCheckoutSession(paidSession, ["a"], deps); // retry → envoi OK
    await finalizePaidCheckoutSession(paidSession, ["a"], deps); // 3e appel → already-finalized

    expect(state.sentPayloads).toHaveLength(2);
    const finalConfirmation = await deps.getConfirmation(paidSession.id);
    expect(finalConfirmation?.email_sent_at).not.toBeNull();
  });
});

describe("M2 — partial payment failure is backfilled idempotently", () => {
  it("first invocation fails after one payment, retry backfills without duplicate", async () => {
    const { deps, state } = makeDeps();
    state.bookings = [
      makeBooking({ booking_ref: "a", base_price: 23, equipment_price: 0, total_price: 23, promo_discount: 0, status: "confirmed" }),
      makeBooking({ booking_ref: "b", base_price: 30, equipment_price: 0, total_price: 30, promo_discount: 0, status: "confirmed" }),
    ];

    // Simule un crash après le 1er paiement : le 2e (booking b) échoue.
    let failBookingB = true;
    const origComplete = deps.completePayment;
    deps.completePayment = async (data) => {
      if (data.booking_id === "b-b" && failBookingB) {
        failBookingB = false;
        throw new Error("simulated crash after first payment");
      }
      return origComplete(data);
    };

    // Invocation 1 : paiement A enregistré, crash sur B → la promise rejette.
    await expect(
      finalizePaidCheckoutSession(paidSession, ["a", "b"], deps),
    ).rejects.toThrow("simulated crash");
    expect(state.payments.map((p) => p.booking_id)).toEqual(["b-a"]);
    expect(state.sentPayloads).toHaveLength(0);

    // Invocation 2 (retry / webhook replay) : backfill idempotent de B.
    const retry = await finalizePaidCheckoutSession(paidSession, ["a", "b"], deps);
    expect(retry.status).toBe("finalized");
    if (retry.status === "finalized") expect(retry.paymentsAdded).toBe(1);

    // Aucun doublon, clé d'idempotence = session.id pour les deux.
    expect(state.payments).toHaveLength(2);
    for (const p of state.payments) {
      expect(p.stripe_event_id).toBe(paidSession.id);
    }
    expect(state.payments.filter((p) => p.booking_id === "b-a")).toHaveLength(1);
    expect(state.payments.filter((p) => p.booking_id === "b-b")).toHaveLength(1);

    // Un seul email, envoyé par l'invocation de récupération.
    expect(state.sentPayloads).toHaveLength(1);
  });
});
