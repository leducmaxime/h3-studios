import { describe, it, expect } from "vitest";
import {
  getSlotDetails,
  getAvailableStudiosForSlot,
  isSlotAvailable,
  isSlotBooked,
  isRangeBookable,
  canBeStartTime,
  canBeEndTime,
  formatDuration,
  ALL_TIME_SLOTS,
  type OccupancyInfo,
  type StudioId,
} from "@/lib/booking";
import { calculatePrice, type PricingGrid } from "@/lib/pricing";

const TEST_GRID: PricingGrid = {
  "la-scene": {
    solo: { offPeak: 6, peak: 6 },
    duo: { offPeak: 12, peak: 12 },
    group: { offPeak: 18, peak: 22 },
  },
  "le-podium": {
    solo: { offPeak: 6, peak: 6 },
    duo: { offPeak: 12, peak: 12 },
    group: { offPeak: 15, peak: 18 },
  },
};

// Helper to create a standard Tuesday (index 2) — both studios open 10:00-22:30/00:00
const tuesday = new Date(2026, 0, 6); // Jan 6, 2026 = Tuesday

function occ(studioId: StudioId, time: string, groupType: OccupancyInfo["groupType"] = "group"): OccupancyInfo {
  return { studioId, time, groupType };
}

function occs(...items: OccupancyInfo[]): Set<OccupancyInfo> {
  return new Set(items);
}

describe("Unified Availability Engine", () => {
  describe("getSlotDetails", () => {
    it("returns correct details for a free slot", () => {
      const details = getSlotDetails("14:00", occs(), tuesday);
      expect(details).toHaveLength(2);
      expect(details.find((d) => d.studioId === "la-scene")?.isOpen).toBe(true);
      expect(details.find((d) => d.studioId === "la-scene")?.occupant).toBeNull();
      expect(details.find((d) => d.studioId === "le-podium")?.isOpen).toBe(true);
      expect(details.find((d) => d.studioId === "le-podium")?.occupant).toBeNull();
    });

    it("returns occupant for occupied slot", () => {
      const details = getSlotDetails("14:00", occs(occ("la-scene", "14:00", "group")), tuesday);
      const scene = details.find((d) => d.studioId === "la-scene")!;
      expect(scene.occupant?.groupType).toBe("group");
      const podium = details.find((d) => d.studioId === "le-podium")!;
      expect(podium.occupant).toBeNull();
    });

    it("returns closed for slots outside opening hours", () => {
      // Monday: BOTH studios open at 18:00
      const monday = new Date(2026, 0, 5); // Jan 5, 2026 = Monday
      const details = getSlotDetails("14:00", occs(), monday);
      expect(details.find((d) => d.studioId === "la-scene")?.isOpen).toBe(false);
      expect(details.find((d) => d.studioId === "le-podium")?.isOpen).toBe(false);
    });
  });

  describe("getAvailableStudiosForSlot", () => {
    it("returns both studios for free slot", () => {
      const studios = getAvailableStudiosForSlot("14:00", occs(), tuesday);
      expect(studios).toContain("la-scene");
      expect(studios).toContain("le-podium");
    });

    it("returns empty for fully occupied slot", () => {
      const studios = getAvailableStudiosForSlot(
        "14:00",
        occs(occ("la-scene", "14:00", "group"), occ("le-podium", "14:00", "group")),
        tuesday
      );
      expect(studios).toHaveLength(0);
    });

    it("returns only free studio when one is occupied (no displacement)", () => {
      const studios = getAvailableStudiosForSlot(
        "14:00",
        occs(occ("la-scene", "14:00", "solo")),
        tuesday
      );
      // La Scène is occupied (regardless of group type), Le Podium is free
      expect(studios).not.toContain("la-scene");
      expect(studios).toContain("le-podium");
    });

    it("returns neither when both studios are occupied", () => {
      const studios = getAvailableStudiosForSlot(
        "14:00",
        occs(occ("la-scene", "14:00", "solo"), occ("le-podium", "14:00", "group")),
        tuesday
      );
      expect(studios).not.toContain("la-scene");
      expect(studios).not.toContain("le-podium");
    });

    it("prevents any group type from using occupied studio", () => {
      const studios = getAvailableStudiosForSlot(
        "14:00",
        occs(occ("la-scene", "14:00", "solo")),
        tuesday
      );
      expect(studios).not.toContain("la-scene");
      expect(studios).toContain("le-podium");
    });
  });

  describe("isSlotAvailable / isSlotBooked", () => {
    it("free slot is available", () => {
      expect(isSlotAvailable("14:00", occs(), tuesday)).toBe(true);
      expect(isSlotBooked("14:00", occs(), tuesday)).toBe(false);
    });

    it("occupied slot is booked", () => {
      const occupancy = occs(occ("la-scene", "14:00", "group"), occ("le-podium", "14:00", "group"));
      expect(isSlotAvailable("14:00", occupancy, tuesday)).toBe(false);
      expect(isSlotBooked("14:00", occupancy, tuesday)).toBe(true);
    });

    it("with studioFilter checks specific studio", () => {
      const occupancy = occs(occ("la-scene", "14:00", "group"));
      // Without filter: Le Podium is free, so slot is available
      expect(isSlotAvailable("14:00", occupancy, tuesday)).toBe(true);
      // With La Scène filter: occupied
      expect(isSlotAvailable("14:00", occupancy, tuesday, "la-scene")).toBe(false);
      // With Le Podium filter: free
      expect(isSlotAvailable("14:00", occupancy, tuesday, "le-podium")).toBe(true);
    });
  });

  describe("isRangeBookable", () => {
    it("returns true for fully free range", () => {
      const result = isRangeBookable("14:00", "16:00", occs(), tuesday);
      expect(result.bookable).toBe(true);
      expect(result.studioId).toBeDefined();
    });

    it("returns false when range has group occupation", () => {
      const occupancy = occs(
        occ("la-scene", "14:30", "group"),
        occ("le-podium", "14:30", "group")
      );
      const result = isRangeBookable("14:00", "16:00", occupancy, tuesday);
      expect(result.bookable).toBe(false);
    });

    it("returns true when one studio is free for entire range despite other being occupied", () => {
      const occupancy = occs(occ("la-scene", "14:30", "solo"));
      // La Scène occupied at 14:30, but Le Podium is free throughout
      const result = isRangeBookable("14:00", "16:00", occupancy, tuesday);
      expect(result.bookable).toBe(true);
      expect(result.studioId).toBe("le-podium");
    });

    it("returns true when one studio is free for entire range", () => {
      const occupancy = occs(occ("la-scene", "14:30", "solo"));
      // La Scène occupied, but Le Podium is free
      const result = isRangeBookable("14:00", "16:00", occupancy, tuesday);
      expect(result.bookable).toBe(true);
      expect(result.studioId).toBe("le-podium");
    });

    it("returns false when both studios have occupation in range", () => {
      const occupancy = occs(
        occ("la-scene", "14:30", "solo"),
        occ("le-podium", "15:00", "group")
      );
      // No single studio is free for the entire range
      const result = isRangeBookable("14:00", "16:00", occupancy, tuesday);
      expect(result.bookable).toBe(false);
    });

    it("returns specific studioId with studioFilter", () => {
      const result = isRangeBookable("14:00", "16:00", occs(), tuesday, "le-podium");
      expect(result.bookable).toBe(true);
      expect(result.studioId).toBe("le-podium");
    });

    it("returns false when filtered studio is occupied", () => {
      const occupancy = occs(occ("le-podium", "14:30", "group"));
      const result = isRangeBookable("14:00", "16:00", occupancy, tuesday, "le-podium");
      expect(result.bookable).toBe(false);
    });

    it("requires same studio for entire range", () => {
      // La Scène free at 14:00, occupied at 14:30
      // Le Podium occupied at 14:00, free at 14:30
      const occupancy = occs(
        occ("la-scene", "14:30", "group"),
        occ("le-podium", "14:00", "group")
      );
      // No single studio is free for the entire range
      const result = isRangeBookable("14:00", "15:00", occupancy, tuesday);
      expect(result.bookable).toBe(false);
    });

    it("handles 00:00 end time correctly", () => {
      // Midnight booking: should include the 00:00 slot
      const result = isRangeBookable("23:00", "00:00", occs(), tuesday);
      expect(result.bookable).toBe(true);
    });
  });

  describe("Off-by-one bug fixes", () => {
    it("calculatePrice includes 00:00 slot", () => {
      const price = calculatePrice(TEST_GRID, "la-scene", "group", tuesday, "23:00", "00:00");
      // 23:00, 23:30 = 2 slots = 1h (00:00 is boundary, not a slot)
      // At peak rate (22€/h for group at La Scène) = 22 * 1 = 22€
      expect(price.total).toBe(22);
      expect(price.breakdown).toHaveLength(2);
    });

    it("formatDuration handles 00:00 correctly", () => {
      // 23:00 -> 00:00 = 2 slots (23:00, 23:30) = 1h
      expect(formatDuration("23:00", "00:00")).toBe("1h");
      // 22:00 -> 00:00 = 4 slots (22:00, 22:30, 23:00, 23:30) = 2h
      expect(formatDuration("22:00", "00:00")).toBe("2h");
    });

  });

  describe("canBeStartTime bug fix", () => {
    it("allows start when exactly MIN_BOOKING_SLOTS are free at end of day", () => {
      // If a studio closes at 22:30, the last 2 slots are 21:30 and 22:00
      // This is exactly MIN_BOOKING_SLOTS (2), so 21:30 should be a valid start
      const visibleSlots = ["21:00", "21:30", "22:00"];
      const isOccupied = (slot: string) => false;
      expect(canBeStartTime("21:30", visibleSlots, isOccupied)).toBe(true);
    });

    it("allows start when more than MIN_BOOKING_SLOTS are free", () => {
      const visibleSlots = ["14:00", "14:30", "15:00", "15:30"];
      const isOccupied = (slot: string) => false;
      expect(canBeStartTime("14:00", visibleSlots, isOccupied)).toBe(true);
    });

    it("rejects start on occupied slot", () => {
      const visibleSlots = ["14:00", "14:30", "15:00"];
      const isOccupied = (slot: string) => slot === "14:00";
      expect(canBeStartTime("14:00", visibleSlots, isOccupied)).toBe(false);
    });

    it("rejects start with insufficient free slots after", () => {
      const visibleSlots = ["14:00", "14:30", "15:00"];
      const isOccupied = (slot: string) => slot === "15:00";
      // 14:00 and 14:30 are free (2 slots), which is exactly MIN_BOOKING_SLOTS
      expect(canBeStartTime("14:00", visibleSlots, isOccupied)).toBe(true);
      // But if 14:30 is also occupied:
      const isOccupied2 = (slot: string) => slot === "14:30" || slot === "15:00";
      expect(canBeStartTime("14:00", visibleSlots, isOccupied2)).toBe(false);
    });
  });

  describe("canBeEndTime", () => {
    it("allows valid end time", () => {
      const visibleSlots = ["14:00", "14:30", "15:00", "15:30"];
      const isOccupied = (slot: string) => false;
      expect(canBeEndTime("14:00", "15:00", visibleSlots, isOccupied)).toBe(true);
    });

    it("rejects end before start", () => {
      const visibleSlots = ["14:00", "14:30", "15:00"];
      const isOccupied = (slot: string) => false;
      expect(canBeEndTime("15:00", "14:00", visibleSlots, isOccupied)).toBe(false);
    });

    it("rejects end too close to start", () => {
      const visibleSlots = ["14:00", "14:30", "15:00"];
      const isOccupied = (slot: string) => false;
      expect(canBeEndTime("14:00", "14:30", visibleSlots, isOccupied)).toBe(false);
    });

    it("allows end at occupied boundary", () => {
      const visibleSlots = ["14:00", "14:30", "15:00", "15:30"];
      const isOccupied = (slot: string) => slot === "15:30";
      // 14:00 to 15:30: 14:30 and 15:00 are free, 15:30 is end (can be occupied)
      expect(canBeEndTime("14:00", "15:30", visibleSlots, isOccupied)).toBe(true);
    });

    it("rejects end when intermediate slot is occupied", () => {
      const visibleSlots = ["14:00", "14:30", "15:00", "15:30"];
      const isOccupied = (slot: string) => slot === "14:30";
      expect(canBeEndTime("14:00", "15:00", visibleSlots, isOccupied)).toBe(false);
    });
  });

  describe("All group types behave identically for availability", () => {
    it("sees both studios when both are free", () => {
      const studios = getAvailableStudiosForSlot("14:00", occs(), tuesday);
      expect(studios).toContain("la-scene");
      expect(studios).toContain("le-podium");
    });

    it("occupied studio is unavailable for all group types", () => {
      // La Scène has solo at 14:00, Le Podium is free
      const occupancy = occs(occ("la-scene", "14:00", "solo"));
      const studios = getAvailableStudiosForSlot("14:00", occupancy, tuesday);
      expect(studios).not.toContain("la-scene");
      expect(studios).toContain("le-podium");
    });

    it("occupied studio is unavailable regardless of occupant group type", () => {
      const occupancy = occs(occ("la-scene", "14:00", "duo"));
      const studios = getAvailableStudiosForSlot("14:00", occupancy, tuesday);
      expect(studios).not.toContain("la-scene");
      expect(studios).toContain("le-podium");
    });

    it("any occupied slot blocks all group types equally (no displacement)", () => {
      const occupancy = occs(occ("la-scene", "14:00", "solo"));
      const studios = getAvailableStudiosForSlot("14:00", occupancy, tuesday);
      // La Scène occupied by solo — no displacement, so it's unavailable
      expect(studios).not.toContain("la-scene");
      expect(studios).toContain("le-podium");
    });
  });

  describe("Range consistency: per-slot vs range-level", () => {
    it("detects range that looks available per-slot but not range-level", () => {
      // La Scène free at 14:00, occupied at 14:30
      // Le Podium occupied at 14:00, free at 14:30
      const occupancy = occs(
        occ("la-scene", "14:30", "solo"),
        occ("le-podium", "14:00", "solo")
      );

      // Per-slot: 14:00 has La Scène free, 14:30 has Le Podium free
      expect(isSlotAvailable("14:00", occupancy, tuesday)).toBe(true);
      expect(isSlotAvailable("14:30", occupancy, tuesday)).toBe(true);

      // But range-level: no single studio covers both
      const rangeResult = isRangeBookable("14:00", "15:00", occupancy, tuesday);
      expect(rangeResult.bookable).toBe(false);
    });

    it("finds the free studio across range when other is occupied", () => {
      // La Scène has solo at 14:00 and 14:30
      // Le Podium is free for both
      const occupancy = occs(
        occ("la-scene", "14:00", "solo"),
        occ("la-scene", "14:30", "solo")
      );

      // Only Le Podium is free for the entire range
      const rangeResult = isRangeBookable("14:00", "15:00", occupancy, tuesday);
      expect(rangeResult.bookable).toBe(true);
      expect(rangeResult.studioId).toBe("le-podium");
    });
  });
});
