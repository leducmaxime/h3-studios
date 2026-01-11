"use client";

import { User, Users } from "lucide-react";
import { type GroupType, PRICING } from "@/lib/booking";

interface GroupTypeToggleProps {
  value: GroupType | null;
  onChange: (type: GroupType | null) => void;
}

const OPTIONS: { type: GroupType; label: string; sublabel: string; icon: typeof User }[] = [
  { type: "solo", label: "Solo", sublabel: "ou Prof", icon: User },
  { type: "duo", label: "Duo", sublabel: "2 pers.", icon: Users },
  { type: "group", label: "Groupe", sublabel: "3+ pers.", icon: Users },
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
