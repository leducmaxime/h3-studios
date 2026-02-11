"use client";

import { Calendar, CreditCard, IdCard, Music, ShoppingCart, Users } from "lucide-react";

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  flow: "time-first" | "studio-first";
  skipStudio?: boolean;
  onStepClick?: (step: number) => void;
  /** When true, booking steps (0-2) are not clickable even if completed */
  cartLocked?: boolean;
}

// Each entry: [Icon, actualStep]
type StepDef = [typeof Users, number];

/**
 * Step flow:
 * 0: GroupType + FlowChoice
 * 1: Date or Studio
 * 2: Time+Studio or Date+Time (inline recap + "Ajouter au panier")
 * 5: Panier
 * 3: Coordonnées (after cart, before payment)
 * 6+: Payment steps (not shown in progress)
 */
function getStepDefs(
  flow: "time-first" | "studio-first",
  skipStudio: boolean
): StepDef[] {
  if (flow === "time-first") {
    if (skipStudio) {
      // Solo/duo: no studio step
      return [
        [Users, 0],          // Group choice
        [Calendar, 1],       // Date + time
        [ShoppingCart, 5],   // Panier
        [IdCard, 3],         // Coordonnées
      ];
    }
    return [
      [Users, 0],            // Group choice
      [Calendar, 1],         // Date + time
      [Music, 2],            // Studio
      [ShoppingCart, 5],     // Panier
      [IdCard, 3],           // Coordonnées
    ];
  }
  // studio-first
  return [
    [Users, 0],              // Group choice
    [Music, 1],              // Studio
    [Calendar, 2],           // Date + time
    [ShoppingCart, 5],       // Panier
    [IdCard, 3],             // Coordonnées
  ];
}

export function ProgressIndicator({
  currentStep,
  totalSteps: _totalSteps,
  flow,
  skipStudio,
  onStepClick,
  cartLocked,
}: ProgressIndicatorProps) {
  const stepDefs = getStepDefs(flow, !!skipStudio);

  // Map each step to its visual position index for progress comparison
  const stepOrder = stepDefs.map(([, s]) => s);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-0">
        {stepDefs.map(([Icon, actualStep], index) => {
          const currentIdx = stepOrder.indexOf(currentStep);
          const thisIdx = index;
          const isCompleted = currentIdx > thisIdx;
          const isCurrent = currentIdx === thisIdx;
          // Cart locked: booking steps (0-2) are not clickable
          const isBookingStep = actualStep <= 2;
          const isClickable = isCompleted && !!onStepClick && !(cartLocked && isBookingStep);

          return (
            <div key={actualStep} className="flex items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      onStepClick(actualStep);
                    }
                  }}
                  className={`
                    relative flex h-10 w-10 items-center justify-center rounded-full
                    transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-primary/20 ring-2 ring-primary"
                        : isCurrent
                          ? "bg-primary/30 ring-2 ring-primary"
                          : "bg-white/5 ring-1 ring-white/20"
                    }
                    ${isClickable ? "hover:bg-primary/40 hover:scale-110" : ""}
                  `}
                >
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  )}
                  <Icon
                    className={`
                      relative h-5 w-5 transition-colors duration-300
                      ${isCompleted || isCurrent ? "text-primary" : "text-white/30"}
                    `}
                  />
                </button>
                <span
                  className={`
                    mt-1.5 text-xs font-medium transition-colors duration-300
                    ${isCompleted || isCurrent ? "text-primary" : "text-white/40"}
                  `}
                >
                  {index + 1}
                </span>
              </div>

              {index < stepDefs.length - 1 && (
                <div
                  className={`
                    mx-2 h-0.5 w-6 sm:w-10 transition-colors duration-300
                    ${currentIdx > thisIdx ? "bg-primary" : "bg-white/20"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-1">
        {stepDefs.map(([, actualStep], index) => {
          const currentIdx = stepOrder.indexOf(currentStep);
          const filled = currentIdx >= index;
          return (
            <div
              key={actualStep}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                filled ? "bg-primary" : "bg-white/20"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
