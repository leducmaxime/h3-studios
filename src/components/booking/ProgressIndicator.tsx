"use client";

import { Calendar, Clock, IdCard, Music, Users } from "lucide-react";

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  flow: "time-first" | "studio-first";
  skipStudio?: boolean;
  onStepClick?: (step: number) => void;
}

// Each entry: [Icon, actualStep]
type StepDef = [typeof Users, number];

function getStepDefs(
  flow: "time-first" | "studio-first",
  skipStudio: boolean
): StepDef[] {
  if (flow === "time-first") {
    if (skipStudio) {
      return [
        [Users, 0],
        [Calendar, 1],
        [Clock, 2],
        [IdCard, 4],
      ];
    }
    return [
      [Users, 0],
      [Calendar, 1],
      [Clock, 2],
      [Music, 3],
      [IdCard, 4],
    ];
  }
  // studio-first
  return [
    [Users, 0],
    [Music, 1],
    [Calendar, 2],
    [Clock, 3],
    [IdCard, 4],
  ];
}

export function ProgressIndicator({
  currentStep,
  totalSteps: _totalSteps,
  flow,
  skipStudio,
  onStepClick,
}: ProgressIndicatorProps) {
  const stepDefs = getStepDefs(flow, !!skipStudio);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-0">
        {stepDefs.map(([Icon, actualStep], index) => {
          const isCompleted = currentStep > actualStep;
          const isCurrent = currentStep === actualStep;
          const isClickable = isCompleted && !!onStepClick;

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
                  {index + 1}
                </span>
              </div>

              {index < stepDefs.length - 1 && (
                <div
                  className={`
                    mx-2 h-0.5 w-6 sm:w-10 transition-colors duration-300
                    ${currentStep > actualStep ? "bg-primary" : "bg-white/20"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-1">
        {stepDefs.map(([, actualStep]) => (
          <div
            key={actualStep}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              currentStep >= actualStep ? "bg-primary" : "bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
