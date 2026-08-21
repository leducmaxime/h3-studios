"use client";

import type { ComponentType } from "react";
import { User, Users } from "lucide-react";

import { type GroupType } from "@/lib/booking";
import { formatEuro } from "@/lib/tax";
import type { MinMaxByGroupType } from "@/lib/pricing";
import { Price, PriceMention } from "@/components/common/Price";

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
  minMaxByGroupType?: MinMaxByGroupType | null;
  /** Heading text — defaults to the public flow wording */
  label?: string;
  /** "public" (default) keeps the public flow styling; "admin" adapts to the zinc admin theme */
  variant?: "public" | "admin";
}

const OPTIONS: { type: GroupType; label: string; sublabel: string; icon: ComponentType<{ className?: string }> }[] = [
  { type: "solo", label: "Solo", sublabel: "ou Prof particulier", icon: User },
  { type: "duo", label: "Duo", sublabel: "2 pers.", icon: Users },
  { type: "group", label: "Groupe", sublabel: "3+ pers.", icon: UsersGroup },
];

function PriceRange({ groupType, minMaxByGroupType }: { groupType: GroupType; minMaxByGroupType?: MinMaxByGroupType | null }) {
  if (!minMaxByGroupType || !minMaxByGroupType[groupType]) return <>…</>;
  const { min, max } = minMaxByGroupType[groupType];
  if (min === max) return <Price amount={min} unit="/h" />;
  // Deux montants, une seule mention partagée — le « TTC/h » entier reste
  // subordonné, la plage « 18€ – 22€ » garde sa taille normale.
  return (
    <span className="whitespace-nowrap">
      <span>{formatEuro(min)} – {formatEuro(max)}</span>
      <PriceMention unit="/h" />
    </span>
  );
}

export function GroupTypeToggle({ value, onChange, minMaxByGroupType, label = "Combien êtes-vous ?", variant = "public" }: GroupTypeToggleProps) {
  const isAdmin = variant === "admin";
  const handleClick = (type: GroupType) => {
    if (value === type) {
      onChange(null);
    } else {
      onChange(type);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className={`text-sm ${isAdmin ? "text-zinc-400" : "font-medium text-white/70"}`}>{label}</span>
      <div className="grid grid-cols-3 gap-1 lg:gap-2">
        {OPTIONS.map(({ type, label, sublabel, icon: Icon }) => {
          const selected = value === type;
          return (
            <button
              key={type}
              onClick={() => handleClick(type)}
              className={`
                flex flex-col items-center gap-0.5 lg:gap-1 rounded-lg p-2 lg:p-3 transition-all
                ${selected
                  ? "bg-primary text-black ring-2 ring-primary ring-offset-1 lg:ring-offset-2 ring-offset-black"
                  : isAdmin
                    ? "border border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                    : "bg-white/15 hover:bg-white/20"
                }
              `}
            >
              <Icon className={`h-4 w-4 lg:h-5 lg:w-5 ${type === "group" ? "scale-110" : ""}`} />
              <span className="text-sm lg:text-base font-semibold">{label}</span>
              <span className={`text-[10px] lg:text-xs ${selected ? "text-black/70" : isAdmin ? "text-zinc-400" : "text-white/60"}`}>
                {sublabel}
              </span>
              {/* 11px (pas 10px) sur mobile : la mention, planchée à 10px,
                  reste ainsi strictement plus petite que le montant. */}
              <span className={`mt-0.5 lg:mt-1 text-[11px] lg:text-xs font-medium ${selected ? "text-black/80" : "text-primary"}`}>
                <PriceRange groupType={type} minMaxByGroupType={minMaxByGroupType} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
