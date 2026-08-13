import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRefund,
  listRefundsForPaymentIntent,
  retrievePaymentIntentIdForSession,
} from "@/lib/stripe";

afterEach(() => {
  vi.unstubAllGlobals();
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Stripe refund transport", () => {
  it("posts form-encoded refund parameters and metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ id: "re_1", amount: 1250, status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);

    await createRefund("sk_test", {
      paymentIntentId: "pi_1",
      amountCents: 1250,
      idempotencyKey: "refund:p1:0:1250",
      metadata: { payment_id: "p1", booking_id: "b1" },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.stripe.com/v1/refunds");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("refund:p1:0:1250");
    expect(init.body).toContain("payment_intent=pi_1");
    expect(init.body).toContain("amount=1250");
    expect(init.body).toContain("metadata%5Bpayment_id%5D=p1");
    expect(init.body).toContain("metadata%5Bbooking_id%5D=b1");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  it("normalizes Stripe error envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { type: "invalid_request_error", code: "charge_already_refunded", message: "Already refunded" } }, 400)));
    const outcome = await createRefund("sk_test", { paymentIntentId: "pi_1", amountCents: 100, idempotencyKey: "key" });
    expect(outcome).toEqual({ ok: false, error: { type: "invalid_request_error", code: "charge_already_refunded", message: "Already refunded", httpStatus: 400 } });
  });

  it("turns a thrown fetch into network_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const outcome = await createRefund("sk_test", { paymentIntentId: "pi_1", amountCents: 100, idempotencyKey: "key" });
    expect(outcome).toEqual({ ok: false, error: { message: "offline", code: "network_error" } });
  });

  it("follows refund-list pagination and concatenates pages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ data: [{ id: "re_1", amount: 100, status: "succeeded" }], has_more: true }))
      .mockResolvedValueOnce(response({ data: [{ id: "re_2", amount: 200, status: "pending" }], has_more: false }));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await listRefundsForPaymentIntent("sk_test", "pi_1");
    expect(outcome).toEqual({ ok: true, data: [{ id: "re_1", amount: 100, status: "succeeded" }, { id: "re_2", amount: 200, status: "pending" }] });
    expect(fetchMock.mock.calls[1][0]).toContain("starting_after=re_1");
  });

  it("fails closed when any refund-list page fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ data: [{ id: "re_1", amount: 100, status: "succeeded" }], has_more: true }))
      .mockResolvedValueOnce(response({ error: { message: "gone" } }, 500));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await listRefundsForPaymentIntent("sk_test", "pi_1");
    expect(outcome).toEqual({ ok: false, error: { message: "gone", httpStatus: 500 } });
  });

  it.each([
    ["string", { payment_intent: "pi_string" }, "pi_string"],
    ["expanded", { payment_intent: { id: "pi_expanded" } }, "pi_expanded"],
    ["null", { payment_intent: null }, null],
  ])("resolves %s payment_intent", async (_name, body, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body)));
    await expect(retrievePaymentIntentIdForSession("sk_test", "cs_1")).resolves.toEqual({ ok: true, data: expected });
  });
});
