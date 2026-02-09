"use client";

import { Calendar, Clock, Music, User } from "lucide-react";

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  flow: "time-first" | "studio-first";
  skipStudio?: boolean;
  onStepClick?: (step: number) => void;
}

const TimeFirstIcons = [Calendar, Clock, Music, User];
const TimeFirstNoStudioIcons = [Calendar, Clock, User];
const StudioFirstIcons = [Music, Calendar, Clock, User];

// Maps visual position (1-based) back to actual state step
function getActualStep(
  visualStep: number,
  skipStudio: boolean
): number {
  if (skipStudio && visualStep >= 3) {
    // visual 3 → actual 4 (coordonnees)
    return visualStep + 1;
  }
  return visualStep;
}

export function ProgressIndicator({
  currentStep,
  totalSteps,
  flow,
  skipStudio,
  onStepClick,
}: ProgressIndicatorProps) {
  const effectiveTotal = skipStudio ? totalSteps - 1 : totalSteps;
  const icons = flow === "time-first"
    ? (skipStudio ? TimeFirstNoStudioIcons : TimeFirstIcons)
    : StudioFirstIcons;
  // For solo/duo time-first: step 1→pos 1, step 2→pos 2, step 4→pos 3
  const effectiveStep = skipStudio && currentStep >= 4 ? currentStep - 1 : currentStep;
  const steps = Array.from({ length: effectiveTotal }, (_, i) => i + 1);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-0">
        {steps.map((step, index) => {
          const Icon = icons[index];
          const isCompleted = effectiveStep > step;
          const isCurrent = effectiveStep === step;
          const isClickable = isCompleted && !!onStepClick;

          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      onStepClick(getActualStep(step, !!skipStudio));
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
                    ${isClickable ? "cursor-pointer hover:bg-primary/40 hover:scale-110" : ""}
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
                  {step}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`
                    mx-2 h-0.5 w-6 sm:w-10 transition-colors duration-300
                    ${effectiveStep > step ? "bg-primary" : "bg-white/20"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-1">
        {steps.map((step) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              effectiveStep >= step ? "bg-primary" : "bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
