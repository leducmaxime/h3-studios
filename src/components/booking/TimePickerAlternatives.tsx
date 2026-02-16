"use client";

import { useState, useMemo, useCallback } from "react";
import { Clock, Calendar, ChevronRight, Zap, Check, ArrowRight, ChevronLeft, ChevronDown } from "lucide-react";
import {
  getStudioTimeSlots,
  getUnionTimeSlots,
  isPeakTime,
  formatDate,
  type StudioId,
  type GroupType,
} from "@/lib/booking";

interface TimelinePickerProps {
  date: Date;
  availability: Set<string>;
  startTime: string | null;
  endTime: string | null;
  onSelectRange: (start: string, end: string) => void;
  studioFilter?: StudioId;
  groupType?: GroupType;
}

const DURATION_OPTIONS = [
  { label: "1h", slots: 2, icon: "⚡" },
  { label: "2h", slots: 4, icon: "🎵" },
  { label: "3h", slots: 6, icon: "🎸" },
  { label: "4h", slots: 8, icon: "🎤" },
  { label: "5h+", slots: 10, icon: "🎹" },
];

export function TimelinePicker({
  date,
  availability,
  startTime,
  endTime,
  onSelectRange,
  studioFilter,
  groupType = "group",
}: TimelinePickerProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(4);

  const visibleSlots = useMemo(() => {
    if (studioFilter) {
      return getStudioTimeSlots(studioFilter, date);
    }
    return getUnionTimeSlots(date);
  }, [studioFilter, date]);

  const hasPeakPricing = groupType === "group";

  const isSlotBooked = useCallback(
    (time: string) => {
      if (studioFilter) {
        return availability.has(`${studioFilter}-${time}`);
      }
      return (
        availability.has(`la-scene-${time}`) &&
        availability.has(`le-podium-${time}`)
      );
    },
    [availability, studioFilter]
  );

  const getSlotData = useCallback(
    (time: string, index: number) => {
      const booked = isSlotBooked(time);
      const peak = hasPeakPricing && isPeakTime(date, time);
      const hour = parseInt(time.split(":")[0]);
      const isHourStart = time.endsWith(":00");

      let canStart = !booked;
      if (canStart && selectedDuration) {
        for (let i = 1; i < selectedDuration && index + i < visibleSlots.length; i++) {
          if (isSlotBooked(visibleSlots[index + i])) {
            canStart = false;
            break;
          }
        }
      }

      return { booked, peak, hour, isHourStart, canStart };
    },
    [date, hasPeakPricing, isSlotBooked, selectedDuration, visibleSlots]
  );

  const handleSlotClick = (time: string, index: number) => {
    const { canStart } = getSlotData(time, index);
    if (!canStart) return;

    const endIdx = Math.min(index + selectedDuration, visibleSlots.length);
    const endTimeValue = endIdx >= visibleSlots.length ? "00:00" : visibleSlots[endIdx];
    onSelectRange(time, endTimeValue);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 bg-black/40 rounded-xl border border-white/10">
      <div className="flex flex-col gap-4">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          1. Choisissez votre durée
        </h4>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map(({ label, slots, icon }) => (
            <button
              key={slots}
              onClick={() => setSelectedDuration(slots)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                ${selectedDuration === slots
                  ? "bg-primary text-black shadow-lg shadow-primary/30"
                  : "bg-white/10 text-white hover:bg-white/20"
                }
              `}
            >
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          2. Glissez pour choisir l&apos;heure
        </h4>

        <div className="relative overflow-x-auto pb-4">
          <div className="flex gap-1 min-w-max px-2">
            {visibleSlots.map((time, index) => {
              const { booked, peak, isHourStart, canStart } = getSlotData(time, index);
              const isSelected = startTime && endTime &&
                index >= visibleSlots.indexOf(startTime) &&
                index < visibleSlots.indexOf(endTime) ||
                (endTime === "00:00" && index >= visibleSlots.indexOf(startTime!));

              return (
                <div key={time} className="flex flex-col items-center">
                  {isHourStart && (
                    <span className="text-[10px] text-white/50 mb-1">
                      {time.split(":")[0]}h
                    </span>
                  )}
                  {!isHourStart && <div className="h-4" />}

                  <button
                    onClick={() => handleSlotClick(time, index)}
                    disabled={!canStart && !booked}
                    className={`
                      w-6 h-16 lg:w-8 lg:h-20 rounded-lg transition-all relative
                      ${booked
                        ? "bg-red-500/20 border border-red-500/30 cursor-not-allowed"
                        : canStart
                          ? peak
                            ? isSelected
                              ? "bg-primary border-2 border-primary"
                              : "bg-primary/20 border border-primary/40 hover:bg-primary/40 cursor-pointer"
                            : isSelected
                              ? "bg-white border-2 border-white"
                              : "bg-white/20 border border-white/30 hover:bg-white/40 cursor-pointer"
                          : "bg-white/5 border border-dashed border-white/10 cursor-not-allowed"
                      }
                    `}
                  >
                    {booked && (
                      <span className="absolute inset-0 flex items-center justify-center text-red-400 text-xs">×</span>
                    )}
                    {isSelected && !booked && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-4 h-4 text-black" />
                      </span>
                    )}
                  </button>

                  {peak && !booked && canStart && !isSelected && (
                    <Zap className="w-3 h-3 text-primary mt-1" />
                  )}
                  {!peak && <div className="h-3 mt-1" />}
                </div>
              );
            })}
          </div>

          {startTime && endTime && (
            <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/30">
              <p className="text-primary font-medium text-center">
                🎵 Répétition de {startTime} à {endTime} ({selectedDuration / 2}h)
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white/20 border border-white/30 rounded" />
            <span>Créneau disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary/20 border border-primary/40 rounded" />
            <span className="text-primary">Heure pleine</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border-2 border-white rounded" />
            <span>Sélectionné</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500/20 border border-red-500/30 rounded flex items-center justify-center text-red-400 text-[8px]">×</div>
            <span>Réservé</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const WIZARD_STEPS = [
  { id: "duration", label: "Durée", icon: Clock },
  { id: "time", label: "Heure", icon: Calendar },
  { id: "confirm", label: "Confirmer", icon: Check },
];

export function WizardPicker({
  date,
  availability,
  startTime,
  endTime,
  onSelectRange,
  studioFilter,
  groupType = "group",
}: TimelinePickerProps) {
  const [step, setStep] = useState<"duration" | "time" | "confirm">("duration");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  const visibleSlots = useMemo(() => {
    if (studioFilter) {
      return getStudioTimeSlots(studioFilter, date);
    }
    return getUnionTimeSlots(date);
  }, [studioFilter, date]);

  const hasPeakPricing = groupType === "group";

  const isSlotBooked = useCallback(
    (time: string) => {
      if (studioFilter) {
        return availability.has(`${studioFilter}-${time}`);
      }
      return (
        availability.has(`la-scene-${time}`) &&
        availability.has(`le-podium-${time}`)
      );
    },
    [availability, studioFilter]
  );

  const canStartAt = useCallback(
    (startIdx: number, duration: number): boolean => {
      const endIdx = startIdx + duration;
      if (endIdx > visibleSlots.length) return false;
      for (let i = startIdx; i < endIdx; i++) {
        if (isSlotBooked(visibleSlots[i])) return false;
      }
      return true;
    },
    [isSlotBooked, visibleSlots]
  );

  const handleDurationSelect = (slots: number) => {
    setSelectedDuration(slots);
    setStep("time");
  };

  const handleTimeSelect = (time: string, index: number) => {
    if (!selectedDuration || !canStartAt(index, selectedDuration)) return;
    const endIdx = Math.min(index + selectedDuration, visibleSlots.length);
    const endTimeValue = endIdx >= visibleSlots.length ? "00:00" : visibleSlots[endIdx];
    onSelectRange(time, endTimeValue);
    setStep("confirm");
  };

  const durationLabel = selectedDuration ? `${selectedDuration / 2}h` : null;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 bg-black/40 rounded-xl border border-white/10">
      <div className="flex items-center justify-center gap-2">
        {WIZARD_STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = s.id === step;
          const isPast = idx < WIZARD_STEPS.findIndex(x => x.id === step);

          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => {
                  if (s.id === "duration") {
                    setStep("duration");
                  } else if (s.id === "time" && selectedDuration) {
                    setStep("time");
                  }
                }}
                disabled={s.id === "confirm" || (s.id === "time" && !selectedDuration)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full transition-all
                  ${isActive
                    ? "bg-primary text-black font-medium"
                    : isPast
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/40"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {idx < WIZARD_STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-white/30 mx-1" />
              )}
            </div>
          );
        })}
      </div>

      <div className="min-h-[300px]">
        {step === "duration" && (
          <div className="flex flex-col gap-6">
            <h4 className="text-xl font-semibold text-center">
              Combien de temps souhaitez-vous répéter ?
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 8].map((hours) => {
                const slots = hours * 2;
                const icon = hours <= 2 ? "⚡" : hours <= 4 ? "🎵" : hours <= 6 ? "🎸" : "🎤";

                return (
                  <button
                    key={hours}
                    onClick={() => handleDurationSelect(slots)}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                      ${selectedDuration === slots
                        ? "bg-primary text-black shadow-lg shadow-primary/30 scale-105"
                        : "bg-white/10 text-white hover:bg-white/20"
                      }
                    `}
                  >
                    <span className="text-3xl">{icon}</span>
                    <span className="text-lg font-bold">{hours}h</span>
                    <span className="text-xs opacity-70">
                      {hours <= 2 ? "Rapide" : hours <= 4 ? "Standard" : "Longue session"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "time" && selectedDuration && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("duration")}
                className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>
              <div className="bg-primary/20 px-4 py-2 rounded-full text-primary font-medium">
                Durée : {durationLabel}
              </div>
            </div>

            <h4 className="text-xl font-semibold text-center">
              À quelle heure commencez-vous ?
            </h4>

            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {visibleSlots.map((time, index) => {
                const canStart = canStartAt(index, selectedDuration);
                const peak = hasPeakPricing && isPeakTime(date, time);

                return (
                  <button
                    key={time}
                    onClick={() => handleTimeSelect(time, index)}
                    disabled={!canStart}
                    className={`
                      p-3 rounded-lg text-center transition-all relative
                      ${!canStart
                        ? "bg-white/5 text-white/20 cursor-not-allowed"
                        : peak
                          ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/30"
                          : "bg-white/10 text-white hover:bg-white/30"
                      }
                    `}
                  >
                    <span className="font-medium">{time}</span>
                    {canStart && (
                      <span className="block text-[10px] opacity-70 mt-1">
                        → {visibleSlots[Math.min(index + selectedDuration, visibleSlots.length - 1)] || "00:00"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "confirm" && startTime && endTime && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <div className="text-center">
              <h4 className="text-2xl font-bold mb-2">Parfait !</h4>
              <p className="text-white/70">
                Votre répétition est programmée de <strong className="text-white">{startTime}</strong> à <strong className="text-white">{endTime}</strong>
              </p>
              <p className="text-primary mt-2 font-medium">
                Durée totale : {durationLabel}
              </p>
            </div>
            <button
              onClick={() => {
                setStep("duration");
                setSelectedDuration(null);
              }}
              className="text-white/50 hover:text-white transition-colors"
            >
              Modifier mon choix
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CompactPicker({
  date,
  availability,
  startTime,
  endTime,
  onSelectRange,
  studioFilter,
  groupType = "group",
}: TimelinePickerProps) {
  const [expandedHour, setExpandedHour] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(4);

  const visibleSlots = useMemo(() => {
    if (studioFilter) {
      return getStudioTimeSlots(studioFilter, date);
    }
    return getUnionTimeSlots(date);
  }, [studioFilter, date]);

  const hasPeakPricing = groupType === "group";

  const isSlotBooked = useCallback(
    (time: string) => {
      if (studioFilter) {
        return availability.has(`${studioFilter}-${time}`);
      }
      return (
        availability.has(`la-scene-${time}`) &&
        availability.has(`le-podium-${time}`)
      );
    },
    [availability, studioFilter]
  );

  const canStartAt = useCallback(
    (startIdx: number): boolean => {
      const endIdx = startIdx + selectedDuration;
      if (endIdx > visibleSlots.length) return false;
      for (let i = startIdx; i < endIdx; i++) {
        if (isSlotBooked(visibleSlots[i])) return false;
      }
      return true;
    },
    [isSlotBooked, selectedDuration, visibleSlots]
  );

  const slotsByHour = useMemo(() => {
    const groups: Record<number, string[]> = {};
    visibleSlots.forEach((slot) => {
      const hour = parseInt(slot.split(":")[0]);
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push(slot);
    });
    return groups;
  }, [visibleSlots]);

  const handleSlotSelect = (time: string, index: number) => {
    if (!canStartAt(index)) return;
    const endIdx = Math.min(index + selectedDuration, visibleSlots.length);
    const endTimeValue = endIdx >= visibleSlots.length ? "00:00" : visibleSlots[endIdx];
    onSelectRange(time, endTimeValue);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 bg-black/40 rounded-xl border border-white/10">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-white/70">Durée :</span>
        <div className="flex flex-wrap gap-2">
          {[2, 3, 4, 5, 6, 8, 10, 12].map((slots) => (
            <button
              key={slots}
              onClick={() => setSelectedDuration(slots)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${selectedDuration === slots
                  ? "bg-primary text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
                }
              `}
            >
              {slots / 2}h
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.entries(slotsByHour).map(([hour, slots]) => {
          const hourNum = parseInt(hour);
          const hasAvailableSlot = slots.some((slot) => {
            const idx = visibleSlots.indexOf(slot);
            return canStartAt(idx);
          });
          const isExpanded = expandedHour === hourNum;
          const anyPeak = slots.some((s) => isPeakTime(date, s));

          return (
            <div
              key={hour}
              className={`rounded-xl overflow-hidden transition-all ${isExpanded ? "col-span-2 row-span-2" : ""}`}
            >
              {!isExpanded ? (
                <button
                  onClick={() => hasAvailableSlot && setExpandedHour(hourNum)}
                  disabled={!hasAvailableSlot}
                  className={`
                    w-full p-4 flex flex-col items-center gap-2 transition-all
                    ${!hasAvailableSlot
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : anyPeak && hasPeakPricing
                        ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer"
                        : "bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                    }
                  `}
                >
                  <span className="text-2xl font-bold">{hour}h</span>
                  <span className="text-xs opacity-70">
                    {hasAvailableSlot ? `${slots.length} créneaux` : "Complet"}
                  </span>
                  {anyPeak && hasPeakPricing && (
                    <Zap className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="bg-white/10 p-4 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xl font-bold">{hour}h - Créneaux</span>
                    <button
                      onClick={() => setExpandedHour(null)}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <ChevronDown className="w-5 h-5 rotate-180" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {slots.map((slot) => {
                      const idx = visibleSlots.indexOf(slot);
                      const canStart = canStartAt(idx);
                      const peak = hasPeakPricing && isPeakTime(date, slot);
                      const endIdx = Math.min(idx + selectedDuration, visibleSlots.length);
                      const endTimeValue = endIdx >= visibleSlots.length ? "00:00" : visibleSlots[endIdx];

                      return (
                        <button
                          key={slot}
                          onClick={() => handleSlotSelect(slot, idx)}
                          disabled={!canStart}
                          className={`
                            p-3 rounded-lg text-center transition-all
                            ${!canStart
                              ? "bg-white/5 text-white/20 cursor-not-allowed"
                              : peak
                                ? "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                                : "bg-white/20 text-white hover:bg-white/30"
                            }
                          `}
                        >
                          <span className="font-medium">{slot}</span>
                          <span className="block text-[10px] opacity-70 mt-1">
                            fin {endTimeValue}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {startTime && endTime && (
        <div className="p-4 bg-primary/10 rounded-xl border border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Votre sélection</p>
              <p className="text-lg font-semibold text-primary">
                {startTime} → {endTime}
              </p>
            </div>
            <button
              onClick={() => onSelectRange("", "")}
              className="text-sm text-white/50 hover:text-white"
            >
              Modifier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChatMessage {
  id: string;
  type: "bot" | "user";
  content: string;
  options?: Array<{
    label: string;
    value: string;
    icon?: string;
    disabled?: boolean;
  }>;
}

export function ChatPicker({
  date,
  availability,
  startTime,
  endTime,
  onSelectRange,
  studioFilter,
  groupType = "group",
}: TimelinePickerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      type: "bot",
      content: `Bonjour ! Prêt pour votre répétition du ${formatDate(date, "short")} ? 🎸`,
    },
    {
      id: "2",
      type: "bot",
      content: "Combien de temps souhaitez-vous répéter ?",
      options: [
        { label: "1 heure", value: "2", icon: "⚡" },
        { label: "2 heures", value: "4", icon: "🎵" },
        { label: "3 heures", value: "6", icon: "🎸" },
        { label: "4 heures", value: "8", icon: "🎤" },
        { label: "5 heures", value: "10", icon: "🎹" },
        { label: "6 heures ou +", value: "12", icon: "🎼" },
      ],
    },
  ]);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [step, setStep] = useState<"duration" | "time" | "confirm">("duration");

  const visibleSlots = useMemo(() => {
    if (studioFilter) {
      return getStudioTimeSlots(studioFilter, date);
    }
    return getUnionTimeSlots(date);
  }, [studioFilter, date]);

  const hasPeakPricing = groupType === "group";

  const isSlotBooked = useCallback(
    (time: string) => {
      if (studioFilter) {
        return availability.has(`${studioFilter}-${time}`);
      }
      return (
        availability.has(`la-scene-${time}`) &&
        availability.has(`le-podium-${time}`)
      );
    },
    [availability, studioFilter]
  );

  const canStartAt = useCallback(
    (startIdx: number, duration: number): boolean => {
      const endIdx = startIdx + duration;
      if (endIdx > visibleSlots.length) return false;
      for (let i = startIdx; i < endIdx; i++) {
        if (isSlotBooked(visibleSlots[i])) return false;
      }
      return true;
    },
    [isSlotBooked, visibleSlots]
  );

  const handleDurationSelect = (slots: string, label: string) => {
    const duration = parseInt(slots);
    setSelectedDuration(duration);

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), type: "user", content: label },
    ]);

    setTimeout(() => {
      const availableSlots = visibleSlots.filter((_, idx) => canStartAt(idx, duration));
      const slotGroups: Record<string, string[]> = {};

      availableSlots.forEach((slot) => {
        const hour = slot.split(":")[0];
        if (!slotGroups[hour]) slotGroups[hour] = [];
        slotGroups[hour].push(slot);
      });

      const timeOptions = Object.entries(slotGroups).slice(0, 8).map(([hour, slots]) => ({
        label: `${hour}h`,
        value: slots[0],
        icon: hasPeakPricing && isPeakTime(date, slots[0]) ? "⚡" : "🕐",
      }));

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "bot",
          content: `Parfait ! ${label} de répétition, c'est noté. 🎵\n\nÀ quelle heure souhaitez-vous commencer ?`,
          options: timeOptions.length > 0 ? timeOptions : undefined,
        },
      ]);
      setStep("time");
    }, 300);
  };

  const handleTimeSelect = (time: string, label: string) => {
    const idx = visibleSlots.indexOf(time);
    if (!selectedDuration || !canStartAt(idx, selectedDuration)) return;

    const endIdx = Math.min(idx + selectedDuration, visibleSlots.length);
    const endTimeValue = endIdx >= visibleSlots.length ? "00:00" : visibleSlots[endIdx];

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), type: "user", content: label },
    ]);

    setTimeout(() => {
      onSelectRange(time, endTimeValue);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "bot",
          content: `Excellent choix ! 🎉\n\nVotre répétition est programmée de **${time}** à **${endTimeValue}**.\n\nDurée totale : ${selectedDuration / 2} heures`,
        },
      ]);
      setStep("confirm");
    }, 300);
  };

  const handleReset = () => {
    setMessages([
      {
        id: "1",
        type: "bot",
        content: `Bonjour ! Prêt pour votre répétition du ${formatDate(date, "short")} ? 🎸`,
      },
      {
        id: "2",
        type: "bot",
        content: "Combien de temps souhaitez-vous répéter ?",
        options: [
          { label: "1 heure", value: "2", icon: "⚡" },
          { label: "2 heures", value: "4", icon: "🎵" },
          { label: "3 heures", value: "6", icon: "🎸" },
          { label: "4 heures", value: "8", icon: "🎤" },
          { label: "5 heures", value: "10", icon: "🎹" },
          { label: "6 heures ou +", value: "12", icon: "🎼" },
        ],
      },
    ]);
    setSelectedDuration(null);
    setStep("duration");
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 bg-black/40 rounded-xl border border-white/10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
          <span className="text-xl">🎸</span>
        </div>
        <div>
          <h4 className="font-semibold">H3 Studios</h4>
          <p className="text-xs text-white/50">En ligne</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === "bot" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`
                max-w-[85%] p-3 rounded-2xl
                ${msg.type === "bot"
                  ? "bg-white/10 text-white rounded-tl-none"
                  : "bg-primary text-black rounded-tr-none"
                }
              `}
            >
              <p className="text-sm whitespace-pre-line">{msg.content}</p>

              {msg.options && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {msg.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (step === "duration") {
                          handleDurationSelect(opt.value, opt.label);
                        } else if (step === "time") {
                          handleTimeSelect(opt.value, opt.label);
                        }
                      }}
                      disabled={opt.disabled}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                        ${msg.type === "bot"
                          ? "bg-white/20 hover:bg-white/30 text-white"
                          : "bg-black/20 hover:bg-black/30 text-black"
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      {opt.icon && <span>{opt.icon}</span>}
                      <span>{opt.label}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {step === "confirm" && (
        <button
          onClick={handleReset}
          className="text-center text-sm text-white/50 hover:text-white transition-colors py-2"
        >
          Recommencer
        </button>
      )}
    </div>
  );
}

interface TimePickerAlternativesProps {
  date: Date;
  availability: Set<string>;
  studioFilter?: StudioId;
  groupType?: GroupType;
}

export function TimePickerAlternatives({
  date,
  availability,
  studioFilter,
  groupType = "group",
}: TimePickerAlternativesProps) {
  const [selections, setSelections] = useState<Record<string, { start: string | null; end: string | null }>>({
    timeline: { start: null, end: null },
    wizard: { start: null, end: null },
    compact: { start: null, end: null },
    chat: { start: null, end: null },
  });

  const handleSelect = (variant: string, start: string, end: string) => {
    setSelections((prev) => ({
      ...prev,
      [variant]: { start, end },
    }));
  };

  return (
    <div className="flex flex-col gap-12 py-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-black font-bold">1</span>
          <div>
            <h3 className="text-xl font-bold">Timeline Visuelle</h3>
            <p className="text-sm text-white/60">Style planning Gantt — vue d&apos;ensemble de la journée</p>
          </div>
        </div>
        <TimelinePicker
          date={date}
          availability={availability}
          startTime={selections.timeline.start}
          endTime={selections.timeline.end}
          onSelectRange={(start, end) => handleSelect("timeline", start, end)}
          studioFilter={studioFilter}
          groupType={groupType}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-black font-bold">2</span>
          <div>
            <h3 className="text-xl font-bold">Wizard Moderne</h3>
            <p className="text-sm text-white/60">Étapes guidées avec pills stylisés et grille adaptative</p>
          </div>
        </div>
        <WizardPicker
          date={date}
          availability={availability}
          startTime={selections.wizard.start}
          endTime={selections.wizard.end}
          onSelectRange={(start, end) => handleSelect("wizard", start, end)}
          studioFilter={studioFilter}
          groupType={groupType}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-black font-bold">3</span>
          <div>
            <h3 className="text-xl font-bold">Vue Condensée</h3>
            <p className="text-sm text-white/60">Blocs horaires extensibles — compact et efficace</p>
          </div>
        </div>
        <CompactPicker
          date={date}
          availability={availability}
          startTime={selections.compact.start}
          endTime={selections.compact.end}
          onSelectRange={(start, end) => handleSelect("compact", start, end)}
          studioFilter={studioFilter}
          groupType={groupType}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-black font-bold">4</span>
          <div>
            <h3 className="text-xl font-bold">Interface Conversationnelle</h3>
            <p className="text-sm text-white/60">Style chat/questionnaire guidé — expérience interactive</p>
          </div>
        </div>
        <ChatPicker
          date={date}
          availability={availability}
          startTime={selections.chat.start}
          endTime={selections.chat.end}
          onSelectRange={(start, end) => handleSelect("chat", start, end)}
          studioFilter={studioFilter}
          groupType={groupType}
        />
      </section>
    </div>
  );
}
