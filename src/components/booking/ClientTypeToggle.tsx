"use client";

import { useRef, type ComponentType, type KeyboardEvent } from "react";
import { Building2, HeartHandshake, User } from "lucide-react";

import { CLIENT_TYPE_RULES, type ClientType } from "@/lib/booking-fields";

/**
 * Type de client — the framing control of the coordonnées step.
 *
 * Visual language follows GroupTypeToggle (3-way segmented control), but the
 * semantics are stricter: this is a REQUIRED single-choice input, so it is a
 * real radiogroup — roving tabindex, arrow/Home/End keys move AND select,
 * which is the keyboard convention for radio groups.
 */

const OPTIONS: { type: ClientType; sublabel: string; icon: ComponentType<{ className?: string }> }[] = [
  { type: "particulier", sublabel: "à titre personnel", icon: User },
  { type: "association", sublabel: "loi 1901 ou assimilée", icon: HeartHandshake },
  { type: "entreprise", sublabel: "société ou auto-entreprise", icon: Building2 },
];

interface ClientTypeToggleProps {
  value: ClientType | null;
  onChange: (type: ClientType) => void;
}

export function ClientTypeToggle({ value, onChange }: ClientTypeToggleProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % OPTIONS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = OPTIONS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(OPTIONS[nextIndex].type);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <span id="client-type-label" className="text-sm font-medium text-white/70">
        Vous réservez en tant que <span className="text-primary" aria-hidden="true">*</span>
      </span>
      <div
        id="clientType"
        role="radiogroup"
        aria-labelledby="client-type-label"
        aria-required="true"
        className="grid grid-cols-3 gap-1 lg:gap-2"
      >
        {OPTIONS.map(({ type, sublabel, icon: Icon }, index) => {
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (value === null && index === 0) ? 0 : -1}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={() => onChange(type)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`
                flex flex-col items-center gap-0.5 lg:gap-1 rounded-lg p-2 lg:p-3 transition-all
                focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black
                ${selected
                  ? "bg-primary text-black ring-2 ring-primary ring-offset-1 lg:ring-offset-2 ring-offset-black"
                  : "bg-white/10 ring-1 ring-inset ring-white/15 hover:bg-white/15 hover:ring-white/30"
                }
              `}
            >
              <Icon aria-hidden="true" className="h-4 w-4 lg:h-5 lg:w-5" />
              <span className="text-xs font-semibold lg:text-base">{CLIENT_TYPE_RULES[type].label}</span>
              <span className={`text-[10px] lg:text-xs ${selected ? "text-black/70" : "text-white/60"}`}>
                {sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
