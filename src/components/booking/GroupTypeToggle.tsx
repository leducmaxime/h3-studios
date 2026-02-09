"use client";

import type { ComponentType } from "react";
import { User, Users } from "lucide-react";

import { type GroupType, PRICING } from "@/lib/booking";

/** 3-person group icon matching lucide style (24x24, stroke-based) */
function UsersGroup({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Center person (main) */}
      <circle cx="12" cy="7" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      {/* Left person (behind) */}
      <path d="M2 21v-2a4 4 0 0 1 3-3.87" />
      <path d="M7 3.128a4 4 0 0 0 0 7.744" />
      {/* Right person (behind) */}
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M17 3.128a4 4 0 0 1 0 7.744" />
    </svg>
  );
}

interface GroupTypeToggleProps {
  value: GroupType | null;
  onChange: (type: GroupType | null) => void;
}

const OPTIONS: { type: GroupType; label: string; sublabel: string; icon: ComponentType<{ className?: string }> }[] = [
  { type: "solo", label: "Solo", sublabel: "ou Prof", icon: User },
  { type: "duo", label: "Duo", sublabel: "2 pers.", icon: Users },
  { type: "group", label: "Groupe", sublabel: "3+ pers.", icon: UsersGroup },
];

function getPriceRange(groupType: GroupType): string {
  const prices = [
    PRICING["la-scene"][groupType].offPeak,
    PRICING["la-scene"][groupType].peak,
    PRICING["le-podium"][groupType].offPeak,
    PRICING["le-podium"][groupType].peak,
  ];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `${min}€/h` : `${min}€ - ${max}€/h`;
}

export function GroupTypeToggle({ value, onChange }: GroupTypeToggleProps) {
  const handleClick = (type: GroupType) => {
    if (value === type) {
      onChange(null);
    } else {
      onChange(type);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-white/70">Combien êtes-vous ?</span>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ type, label, sublabel, icon: Icon }) => {
          const selected = value === type;
          const priceRange = getPriceRange(type);
          return (
            <button
              key={type}
              onClick={() => handleClick(type)}
              className={`
                flex flex-col items-center gap-1 rounded-lg p-3 transition-all
                ${selected
                  ? "bg-primary text-black ring-2 ring-primary ring-offset-2 ring-offset-black"
                  : "bg-white/10 hover:bg-white/20"
                }
              `}
            >
              <Icon className={`h-5 w-5 ${type === "group" ? "scale-110" : ""}`} />
              <span className="font-semibold">{label}</span>
              <span className={`text-xs ${selected ? "text-black/70" : "text-white/60"}`}>
                {sublabel}
              </span>
              <span className={`mt-1 text-xs font-medium ${selected ? "text-black/80" : "text-primary"}`}>
                {priceRange}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
