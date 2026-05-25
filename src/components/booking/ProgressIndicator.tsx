"use client";

import { Calendar, CircleCheckBig, CreditCard, IdCard, ShoppingCart, Users } from "lucide-react";

interface ProgressIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  /** When true, booking steps (0-1) are not clickable even if completed */
  cartLocked?: boolean;
}

// Each entry: [Icon, actualStep]
type StepDef = [typeof Users, number];

/**
 * Step flow:
 * 0: Type (GroupType)
 * 1: Date & Créneaux (Date+Time+Studio)
 * 2: Coordonnées (BookingForm)
 * 3: Panier (CartPage)
 * 4: Paiement (PaymentChoice + StripeRedirect)
 * 5: Terminé (FinalCheckout)
 */
function getStepDefs(): StepDef[] {
  return [
    [Users, 0],              // Type
    [Calendar, 1],           // Date & Créneaux
    [IdCard, 2],             // Coordonnées
    [ShoppingCart, 3],       // Panier
    [CreditCard, 4],         // Paiement
    [CircleCheckBig, 5],     // Terminé
  ];
}

export function ProgressIndicator({
  currentStep,
  onStepClick,
  cartLocked,
}: ProgressIndicatorProps) {
  const stepDefs = getStepDefs();

  // Map each step to its visual position index for progress comparison
  const stepOrder = stepDefs.map(([, s]) => s);

  const resolvedStep = currentStep;
  const currentIdx = stepOrder.indexOf(resolvedStep);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-0">
        {stepDefs.map(([Icon, actualStep], index) => {
          const thisIdx = index;
          const isCompleted = currentIdx > thisIdx;
          const isCurrent = currentIdx === thisIdx;
          // Cart locked: booking steps (0-1) are not clickable
          // Payment/confirmation steps (4-5) are never clickable
          const isBookingStep = actualStep <= 1;
          const isPaymentStep = actualStep >= 4;
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
