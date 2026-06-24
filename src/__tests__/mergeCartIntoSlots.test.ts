import { describe, it, expect } from "vitest";
import {
  mergeCartIntoSlots,
  type SlotEntry,
  type SlotsByStudio,
} from "@/components/booking/useBookingWithRouter";
import {
  canBeStartTime,
  ALL_TIME_SLOTS,
  type StudioId,
  type GroupType,
} from "@/lib/booking";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tuesday = new Date(2026, 0, 6); // Jan 6, 2026 = Tuesday  (day 2)
const wednesday = new Date(2026, 0, 7); // Jan 7, 2026 = Wednesday (day 3, different date)

function slot(time: string, available = true): SlotEntry {
  return { time, available };
}

function sceneSlots(...times: string[]): SlotEntry[] {
  return times.map((t) => slot(t));
}

function makeBooking(overrides: {
  studioId: StudioId;
  startTime: string;
  endTime: string;
  groupType?: GroupType;
  date?: Date;
}): any /* CompletedBooking shape */ {
  return {
    id: "test-" + Math.random().toString(36).slice(2),
    date: overrides.date ?? tuesday,
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    studioId: overrides.studioId,
    groupType: overrides.groupType ?? "group",
    userName: "",
    userEmail: "",
    userPhone: "",
    bandName: "",
    bookingRef: "TEST-REF",
    price: 0,
    equipment: [],
    equipmentPrice: 0,
    promoCode: null,
    round_mode: null,
    promoDiscount: 0,
    paymentMethod: "cash",
    paymentStatus: "pending",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mergeCartIntoSlots", () => {
  it("marks same-date cart booking slots unavailable in correct studio only", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("14:00", "14:30", "15:00", "15:30"),
      "le-podium": sceneSlots("14:00", "14:30", "15:00", "15:30"),
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "14:00", endTime: "15:00", groupType: "duo" }),
    ];
    const result = mergeCartIntoSlots(apiSlots, cart, tuesday);

    // La Scène: 14:00 and 14:30 flipped, 15:00 is end boundary so not flipped
    expect(result["la-scene"]).toEqual([
      { time: "14:00", available: false, groupType: "duo" },
      { time: "14:30", available: false, groupType: "duo" },
      { time: "15:00", available: true },
      { time: "15:30", available: true },
    ]);

    // Le Podium: completely unchanged
    expect(result["le-podium"]).toEqual([
      { time: "14:00", available: true },
      { time: "14:30", available: true },
      { time: "15:00", available: true },
      { time: "15:30", available: true },
    ]);
  });

  it("does not affect slots for cart bookings on other dates", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("14:00", "14:30"),
    };
    const cart = [
      makeBooking({
        studioId: "la-scene",
        startTime: "14:00",
        endTime: "15:00",
        date: wednesday,
      }),
    ];
    // Merge with tuesday as selected date
    const result = mergeCartIntoSlots(apiSlots, cart, tuesday);
    expect(result["la-scene"]).toEqual([
      { time: "14:00", available: true },
      { time: "14:30", available: true },
    ]);
  });

  it("does not inject phantom slots for times outside the API slot array", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("14:00", "14:30"),
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "14:00", endTime: "15:30" }),
    ];
    const result = mergeCartIntoSlots(apiSlots, cart, tuesday);

    // Still only 2 entries — no "15:00" or "15:30" injected
    expect(result["la-scene"]).toHaveLength(2);
    expect(result["la-scene"]![0]).toEqual({ time: "14:00", available: false, groupType: "group" });
    expect(result["la-scene"]![1]).toEqual({ time: "14:30", available: false, groupType: "group" });
  });

  it("preserves bookingId and other properties on flipped slots", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": [
        { time: "14:00", available: true, bookingId: "abc" },
        { time: "14:30", available: true, bookingId: "def" },
      ],
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "14:00", endTime: "14:30" }),
    ];
    const result = mergeCartIntoSlots(apiSlots, cart, tuesday);

    // bookingId preserved, available flipped, groupType added
    expect(result["la-scene"]![0]).toEqual({
      time: "14:00",
      available: false,
      groupType: "group",
      bookingId: "abc",
    });
    expect(result["la-scene"]![1]).toHaveProperty("bookingId", "def");
  });

  describe("00:00 end boundary", () => {
    it("flips 23:00 and 23:30 but leaves 00:00 available", () => {
      const apiSlots: SlotsByStudio = {
        "la-scene": sceneSlots("23:00", "23:30", "00:00"),
      };
      const cart = [
        makeBooking({ studioId: "la-scene", startTime: "23:00", endTime: "00:00" }),
      ];
      const result = mergeCartIntoSlots(apiSlots, cart, tuesday);

      expect(result["la-scene"]).toHaveLength(3);
      expect(result["la-scene"]![0]).toEqual({ time: "23:00", available: false, groupType: "group" });
      expect(result["la-scene"]![1]).toEqual({ time: "23:30", available: false, groupType: "group" });
      expect(result["la-scene"]![2]).toEqual({ time: "00:00", available: true });
    });

    it("handles non-midnight end normally (no boundary slot involved)", () => {
      const apiSlots: SlotsByStudio = {
        "la-scene": sceneSlots("23:00", "23:30", "00:00"),
      };
      const cart = [
        makeBooking({ studioId: "la-scene", startTime: "23:00", endTime: "23:30" }),
      ];
      const result = mergeCartIntoSlots(apiSlots, cart, tuesday);

      // Only 23:00 is occupied (end-exclusive: 23:30 is boundary)
      expect(result["la-scene"]![0]).toEqual({ time: "23:00", available: false, groupType: "group" });
      expect(result["la-scene"]![1]).toEqual({ time: "23:30", available: true });
    });
  });

  it("returns the same reference when cart is empty", () => {
    const apiSlots: SlotsByStudio = { "la-scene": sceneSlots("10:00") };
    expect(mergeCartIntoSlots(apiSlots, [], tuesday)).toBe(apiSlots);
  });

  it("returns the same reference when selectedDate is null", () => {
    const apiSlots: SlotsByStudio = { "la-scene": sceneSlots("10:00") };
    expect(mergeCartIntoSlots(apiSlots, [], null)).toBe(apiSlots);
  });

  it("handles multiple cart bookings on same date and studio", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("10:00", "10:30", "11:00", "11:30", "12:00"),
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "10:00", endTime: "11:00", groupType: "solo" }),
      makeBooking({ studioId: "la-scene", startTime: "11:30", endTime: "12:00", groupType: "duo" }),
    ];
    const result = mergeCartIntoSlots(apiSlots, cart, tuesday);

    expect(result["la-scene"]![0]).toEqual({ time: "10:00", available: false, groupType: "solo" });
    expect(result["la-scene"]![1]).toEqual({ time: "10:30", available: false, groupType: "solo" });
    expect(result["la-scene"]![2]).toEqual({ time: "11:00", available: true });  // between the two
    expect(result["la-scene"]![3]).toEqual({ time: "11:30", available: false, groupType: "duo" });
    expect(result["la-scene"]![4]).toEqual({ time: "12:00", available: true });  // end boundary
  });
});

describe("cart-derived runway (canBeStartTime on merged slots)", () => {
  it("returns false with only one free slot before cart-occupied boundary", () => {
    // API has 5 slots; cart occupies 16:00→16:30, so only 16:00 is flipped
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("15:00", "15:30", "16:00", "16:30", "17:00"),
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "16:00", endTime: "16:30" }),
    ];
    const merged = mergeCartIntoSlots(apiSlots, cart, tuesday);

    // isOccupied callback reads from merged (cart-aware) slot data
    const isOccupied = (t: string): boolean => {
      const entry = merged["la-scene"]!.find((s) => s.time === t);
      return entry ? !entry.available : true;
    };

    // Visible slots for this test window
    const visibleSlots = ["15:00", "15:30", "16:00", "16:30", "17:00"];

    // "15:30" has only itself free before hitting occupied "16:00"
    expect(canBeStartTime("15:30", visibleSlots, isOccupied)).toBe(false);
  });

  it("returns true with two free slots before cart-occupied boundary", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("15:00", "15:30", "16:00", "16:30", "17:00"),
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "16:00", endTime: "16:30" }),
    ];
    const merged = mergeCartIntoSlots(apiSlots, cart, tuesday);

    const isOccupied = (t: string): boolean => {
      const entry = merged["la-scene"]!.find((s) => s.time === t);
      return entry ? !entry.available : true;
    };

    const visibleSlots = ["15:00", "15:30", "16:00", "16:30", "17:00"];

    // "15:00" has two free slots ahead (15:00, 15:30) before occupied "16:00"
    expect(canBeStartTime("15:00", visibleSlots, isOccupied)).toBe(true);
  });

  it("returns false for slot that is itself occupied by cart", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("15:00", "15:30", "16:00", "16:30", "17:00"),
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "16:00", endTime: "16:30" }),
    ];
    const merged = mergeCartIntoSlots(apiSlots, cart, tuesday);

    const isOccupied = (t: string): boolean => {
      const entry = merged["la-scene"]!.find((s) => s.time === t);
      return entry ? !entry.available : true;
    };

    const visibleSlots = ["15:00", "15:30", "16:00", "16:30", "17:00"];

    // "16:00" is occupied by the cart
    expect(canBeStartTime("16:00", visibleSlots, isOccupied)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Group displacement over solo/duo cart items
  // ---------------------------------------------------------------------------

  it("group selection ignores solo/duo cart items (group can overwrite)", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("14:00", "14:30", "15:00"),
      "le-podium": sceneSlots("14:00", "14:30", "15:00"),
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "14:00", endTime: "15:00", groupType: "solo" }),
    ];

    // When selecting as group, solo cart item does not block the slot
    const resultAsGroup = mergeCartIntoSlots(apiSlots, cart, tuesday, "group");
    expect(resultAsGroup["la-scene"]![0].available).toBe(true);
    expect(resultAsGroup["la-scene"]![1].available).toBe(true);

    // When selecting as solo/duo, the cart item still blocks
    const resultAsSolo = mergeCartIntoSlots(apiSlots, cart, tuesday, "solo");
    expect(resultAsSolo["la-scene"]![0].available).toBe(false);
    expect(resultAsSolo["la-scene"]![1].available).toBe(false);
  });

  it("group selection still blocks group cart items", () => {
    const apiSlots: SlotsByStudio = {
      "la-scene": sceneSlots("14:00", "14:30"),
    };
    const cart = [
      makeBooking({ studioId: "la-scene", startTime: "14:00", endTime: "14:30", groupType: "group" }),
    ];

    const result = mergeCartIntoSlots(apiSlots, cart, tuesday, "group");
    expect(result["la-scene"]![0].available).toBe(false);
  });
});
