"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { WeekCalendar } from "@/components/booking/WeekCalendar";
import { TimeSlotPicker } from "@/components/booking/TimeSlotPicker";
import { usePricing } from "@/components/booking/usePricing";
import {
  ALL_TIME_SLOTS,
  getAdminSlotWarnings,
  type GroupType,
  type StudioId,
} from "@/lib/booking";
import { formatDateISO, getParisDateISO } from "@/lib/utils";

type SlotData = { time: string; available: boolean; groupType?: string; bookingId?: string };

interface AdminSlotPickerProps {
  date: string; // ISO YYYY-MM-DD, may be ""
  startTime: string; // "" if unset
  endTime: string;
  studioId: StudioId | null;
  groupType: GroupType | null;
  onChange: (next: {
    date: string;
    startTime: string;
    endTime: string;
    studioId: StudioId | null;
  }) => void;
  excludeBookingId?: string; // reschedule: hide this booking from occupied
}

/** Phrases complètes pour les raisons retournées par getAdminSlotWarnings. */
const WARNING_SENTENCES: Record<string, string> = {
  "Date passée": "Ce créneau est dans le passé.",
  "Durée inférieure à 1 heure": "Ce créneau dure moins d'une heure.",
  "Chevauche une réservation ou un blocage existant":
    "Ce créneau chevauche une réservation ou un blocage existant.",
  "Hors horaires d'ouverture": "Ce créneau est en dehors des horaires d'ouverture.",
};

export function AdminSlotPicker({
  date,
  startTime,
  endTime,
  studioId,
  groupType,
  onChange,
  excludeBookingId,
}: AdminSlotPickerProps) {
  const { pricing, error: pricingError, refetch: refetchPricing } = usePricing();
  const [slotsByStudio, setSlotsByStudio] = useState<Record<string, SlotData[]>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);

  const selectedDate = useMemo(
    () => (date ? new Date(`${date}T00:00:00`) : null),
    [date]
  );

  // Availability for the selected date. Admin override: no applyMinAdvance,
  // no todayFullyBlocked — raw occupancy only, so any slot stays selectable.
  const fetchGenRef = useRef(0);
  useEffect(() => {
    if (!date) {
      setSlotsByStudio({});
      return;
    }
    const gen = ++fetchGenRef.current;
    setSlotsLoading(true);
    const params = new URLSearchParams({ date });
    if (excludeBookingId) params.set("excludeBookingId", excludeBookingId);
    fetch(`/api/availability?${params}`)
      .then((res) => res.json())
      .then((data: unknown) => {
        if (gen !== fetchGenRef.current) return; // stale response
        setSlotsLoading(false);
        const json = data as { success: boolean; data?: { slots: Record<string, SlotData[]> } };
        if (json.success && json.data) setSlotsByStudio(json.data.slots);
      })
      .catch(() => {
        if (gen === fetchGenRef.current) setSlotsLoading(false);
      });
  }, [date, excludeBookingId]);

  const handleSelectDate = (next: Date) => {
    const nextISO = formatDateISO(next);
    if (nextISO === date) return; // same day: keep the current selection
    onChange({ date: nextISO, startTime: "", endTime: "", studioId: null });
  };

  const handleSelectRange = (start: string, end: string, studio: StudioId) => {
    onChange({ date, startTime: start, endTime: end, studioId: studio });
  };

  const handleClear = () => {
    onChange({ date, startTime: "", endTime: "", studioId: null });
  };

  // Warnings only — never blocking. Occupied times inside the selected range.
  const warnings = useMemo(() => {
    if (!selectedDate || !startTime || !endTime || !studioId) return [];
    const startIdx = ALL_TIME_SLOTS.indexOf(startTime);
    let endIdx = ALL_TIME_SLOTS.indexOf(endTime);
    if (endTime === "00:00") endIdx = ALL_TIME_SLOTS.length;
    const inRange =
      startIdx !== -1 && endIdx > startIdx
        ? new Set(ALL_TIME_SLOTS.slice(startIdx, endIdx))
        : new Set<string>();
    const occupiedTimes = (slotsByStudio[studioId] ?? [])
      .filter((s) => s.available === false && inRange.has(s.time))
      .map((s) => s.time);
    return getAdminSlotWarnings({
      date: selectedDate,
      startTime,
      endTime,
      studioId,
      occupiedTimes,
      todayISO: getParisDateISO(),
    });
  }, [selectedDate, startTime, endTime, studioId, slotsByStudio]);

  return (
    <div className="flex flex-col gap-4">
      <WeekCalendar
        allowOverride
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        studioFilter={studioId}
        groupType={groupType}
        maxAdvanceDays={730}
      />

      {selectedDate && (
        <TimeSlotPicker
          allowOverride
          hideHeader
          onBack={() => {}}
          date={selectedDate}
          slotsByStudio={slotsByStudio}
          slotsLoading={slotsLoading}
          startTime={startTime || null}
          endTime={endTime || null}
          studioId={studioId}
          onSelectRange={handleSelectRange}
          onClear={handleClear}
          groupType={groupType ?? "group"}
          pricingGrid={pricing?.grid}
          pricingError={pricingError}
          refetchPricing={refetchPricing}
        />
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="flex flex-col gap-1 text-sm text-amber-200">
              {warnings.map((w) => (
                <p key={w}>{WARNING_SENTENCES[w] ?? w}</p>
              ))}
              <p className="text-amber-200/70">L&apos;enregistrement reste possible.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
