"use client";

import { Calendar, CircleCheckBig, CreditCard, IdCard, ShoppingCart, Users } from "lucide-react";

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  flow: "time-first" | "studio-first";
  skipStudio?: boolean;
  onStepClick?: (step: number) => void;
  /** When true, booking steps (0-1) are not clickable even if completed */
  cartLocked?: boolean;
}

// Each entry: [Icon, actualStep]
type StepDef = [typeof Users, number];

/**
 * Step flow:
 * 0: GroupType + FlowChoice
 * 1: Unified booking (Date+Time+Studio all on one page)
 * 5: Panier
 * 3: Coordonnées (after cart, before payment)
 * 6: Choix de paiement (7: Stripe redirect — grouped with 6 visually)
 * 8: Confirmation
 */
function getStepDefs(): StepDef[] {
  // All flows now share the same step structure (step 2 merged into step 1)
  return [
    [Users, 0],              // Group choice
    [Calendar, 1],           // Unified booking (date + time + studio)
    [ShoppingCart, 5],       // Panier
    [IdCard, 3],             // Coordonnées
    [CreditCard, 6],         // Paiement
    [CircleCheckBig, 8],     // Confirmation
  ];
}

export function ProgressIndicator({
  currentStep,
  totalSteps: _totalSteps,
  flow: _flow,
  skipStudio: _skipStudio,
  onStepClick,
  cartLocked,
}: ProgressIndicatorProps) {
  const stepDefs = getStepDefs();

  // Map each step to its visual position index for progress comparison
  const stepOrder = stepDefs.map(([, s]) => s);

  // Step 7 (Stripe redirect) is visually grouped with step 6 (payment choice)
  const resolvedStep = currentStep === 7 ? 6 : currentStep;
  const currentIdx = stepOrder.indexOf(resolvedStep);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-0">
        {stepDefs.map(([Icon, actualStep], index) => {
          const thisIdx = index;
          const isCompleted = currentIdx > thisIdx;
          const isCurrent = currentIdx === thisIdx;
          // Cart locked: booking steps (0-1) are not clickable
          // Payment/confirmation steps (6-8) are never clickable
          const isBookingStep = actualStep <= 1;
          const isPaymentStep = actualStep >= 6;
          const isClickable = isCompleted && !!onStepClick && !(cartLocked && isBookingStep) && !isPaymentStep;

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
        {stepDefs.map(([, actualStep], index) => (
          <div
            key={actualStep}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              currentIdx >= index ? "bg-primary" : "bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
