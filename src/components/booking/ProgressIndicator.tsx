"use client";

import { Calendar, CircleCheckBig, CreditCard, IdCard, ShoppingCart, Users } from "lucide-react";
import { BOOKING_STEPS, type BookingStep, stepIndex } from "@/lib/booking";

interface ProgressIndicatorProps {
  currentStep: BookingStep;
  onStepClick?: (step: BookingStep) => void;
  /** Guard-based clickability check from the hook */
  canNavigateToStep?: (step: BookingStep) => boolean;
}

type StepDef = {
  icon: typeof Users;
  step: BookingStep;
  label: string;
};

/**
 * Step flow (traversal order):
 *   Type → Créneaux → Panier → Coordonnées → Paiement → Terminé
 */
function getStepDefs(): StepDef[] {
  return [
    { icon: Users, step: "groupe", label: "Type" },
    { icon: Calendar, step: "creneau", label: "Créneaux" },
    { icon: ShoppingCart, step: "panier", label: "Panier" },
    { icon: IdCard, step: "coordonnees", label: "Coordonnées" },
    { icon: CreditCard, step: "paiement", label: "Paiement" },
    { icon: CircleCheckBig, step: "termine", label: "Terminé" },
  ];
}

export function ProgressIndicator({
  currentStep,
  onStepClick,
  canNavigateToStep,
}: ProgressIndicatorProps) {
  const stepDefs = getStepDefs();

  const currentIdx = stepIndex(currentStep);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-0">
        {stepDefs.map(({ icon: Icon, step, label }, index) => {
          const thisIdx = index;
          const isCompleted = currentIdx > thisIdx;
          const isCurrent = currentIdx === thisIdx;
          const isClickable =
            isCompleted &&
            !!onStepClick &&
            !!canNavigateToStep?.(step);

          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      onStepClick(step);
                    }
                  }}
                  className={`
                    relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full
                    transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-primary/20 ring-2 ring-primary"
                        : isCurrent
                          ? "bg-primary/30 ring-2 ring-primary"
                          : "bg-white/15 ring-1 ring-white/20"
                    }
                    ${isClickable ? "hover:bg-primary/40 hover:scale-110" : ""}
                  `}
                >
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  )}
                <Icon
                  className={`
                    relative h-4 w-4 sm:h-5 sm:w-5 transition-colors duration-300
                    ${isCompleted || isCurrent ? "text-primary" : "text-white/30"}
                  `}
                />
                </button>
                <span
                  className={`
                    mt-1.5 text-xs font-medium transition-colors duration-300 hidden sm:block
                    ${isCompleted || isCurrent ? "text-primary" : "text-white/40"}
                  `}
                >
                  {index + 1}
                </span>
              </div>

              {index < stepDefs.length - 1 && (
                <div
                  className={`
                    mx-1 sm:mx-2 h-0.5 w-3 sm:w-6 md:w-10 transition-colors duration-300
                    ${currentIdx > thisIdx ? "bg-primary" : "bg-white/20"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-1">
        {stepDefs.map(({ step }, index) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              currentIdx >= index ? "bg-primary" : "bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
