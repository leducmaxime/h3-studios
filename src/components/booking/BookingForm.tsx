"use client";

import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import {
  type StudioId,
  type GroupType,
} from "@/lib/booking";

interface BookingFormProps {
  date: Date;
  startTime: string;
  endTime: string;
  studioId: StudioId;
  groupType: GroupType;
  userName: string;
  userEmail: string;
  userPhone: string;
  bandName: string;
  billingAddress: string;
  billingPostalCode: string;
  billingCity: string;
  additionalInfo: string;
  onUpdateField: (field: "userName" | "userEmail" | "userPhone" | "bandName" | "billingAddress" | "billingPostalCode" | "billingCity" | "additionalInfo", value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  canContinue: boolean;
}

export function BookingForm({
  date,
  startTime,
  endTime,
  studioId,
  groupType,
  userName,
  userEmail,
  userPhone,
  bandName,
  billingAddress,
  billingPostalCode,
  billingCity,
  additionalInfo,
  onUpdateField,
  onContinue,
  onBack,
  canContinue,
}: BookingFormProps) {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (userEmail && !emailRegex.test(userEmail)) {
      errors.userEmail = "L'email est invalide";
    }

    const phoneDigits = userPhone.replace(/\D/g, "");
    if (userPhone && phoneDigits.length !== 10) {
      errors.userPhone = "Le numéro de téléphone est invalide";
    }

    const postalCodeDigits = billingPostalCode.replace(/\D/g, "");
    if (billingPostalCode && postalCodeDigits.length !== 5) {
      errors.billingPostalCode = "Le code postal est invalide";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContinue = () => {
    if (!canContinue) return;

    if (validateForm()) {
      onContinue();
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    onUpdateField(field as "userName" | "userEmail" | "userPhone" | "bandName" | "billingAddress" | "billingPostalCode" | "billingCity" | "additionalInfo", value);
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onBack}
          className="rounded-full p-2 transition-colors hover:bg-white/10"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold sm:text-lg">Vos coordonnées</h3>
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="userName" className="text-sm font-medium text-white/70">
            Prénom et Nom <span className="text-primary">*</span>
          </label>
          <input
            id="userName"
            type="text"
            value={userName}
            onChange={(e) => handleFieldChange("userName", e.target.value)}
            placeholder="Jean Dupont"
            required
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="userEmail" className="text-sm font-medium text-white/70">
            Email <span className="text-primary">*</span>
          </label>
          <input
            id="userEmail"
            type="email"
            value={userEmail}
            onChange={(e) => handleFieldChange("userEmail", e.target.value)}
            placeholder="jean@exemple.fr"
            required
            className={`rounded-lg border bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3 ${
              validationErrors.userEmail ? "border-red-500" : "border-white/20"
            }`}
          />
          {validationErrors.userEmail && (
            <span className="text-xs text-red-400">{validationErrors.userEmail}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="userPhone" className="text-sm font-medium text-white/70">
            Téléphone <span className="text-primary">*</span>
          </label>
          <input
            id="userPhone"
            type="tel"
            value={userPhone}
            onChange={(e) => handleFieldChange("userPhone", e.target.value.replace(/\D/g, ""))}
            placeholder="0612345678"
            maxLength={10}
            required
            className={`rounded-lg border bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3 ${
              validationErrors.userPhone ? "border-red-500" : "border-white/20"
            }`}
          />
          {validationErrors.userPhone && (
            <span className="text-xs text-red-400">{validationErrors.userPhone}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bandName" className="text-sm font-medium text-white/70">
            Nom du groupe <span className="text-white/40">(optionnel)</span>
          </label>
          <input
            id="bandName"
            type="text"
            value={bandName}
            onChange={(e) => handleFieldChange("bandName", e.target.value)}
            placeholder="Les Rockers"
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        <h4 className="text-sm font-semibold text-white/80">Adresse de facturation</h4>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="billingAddress" className="text-sm font-medium text-white/70">
            Nom et numéro de rue <span className="text-primary">*</span>
          </label>
          <input
            id="billingAddress"
            type="text"
            value={billingAddress}
            onChange={(e) => handleFieldChange("billingAddress", e.target.value)}
            placeholder="12 Rue de la Musique"
            required
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3"
          />
        </div>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="billingPostalCode" className="text-sm font-medium text-white/70">
              Code postal <span className="text-primary">*</span>
            </label>
            <input
              id="billingPostalCode"
              type="text"
              inputMode="numeric"
              value={billingPostalCode}
              onChange={(e) => handleFieldChange("billingPostalCode", e.target.value.replace(/\D/g, ""))}
              placeholder="94370"
              maxLength={5}
              required
              className={`rounded-lg border bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3 ${
                validationErrors.billingPostalCode ? "border-red-500" : "border-white/20"
              }`}
            />
            {validationErrors.billingPostalCode && (
              <span className="text-xs text-red-400">{validationErrors.billingPostalCode}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="billingCity" className="text-sm font-medium text-white/70">
              Ville <span className="text-primary">*</span>
            </label>
            <input
              id="billingCity"
              type="text"
              value={billingCity}
              onChange={(e) => handleFieldChange("billingCity", e.target.value)}
              placeholder="Sucy-en-Brie"
              required
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:px-4 sm:py-3"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="additionalInfo" className="text-sm font-medium text-white/70">
          Informations supplémentaires
        </label>
        <textarea
          id="additionalInfo"
          value={additionalInfo}
          onChange={(e) => handleFieldChange("additionalInfo", e.target.value)}
          placeholder="Quels instruments ? Nombre de chanteurs ? besoin de matériel ? autres infos utiles..."
          rows={3}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y sm:px-4 sm:py-3"
        />
      </div>

      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className={`
          w-full rounded-lg py-3.5 text-base font-semibold transition-all sm:py-4 sm:text-lg
          ${canContinue
            ? "bg-primary text-black hover:bg-primary/90"
            : "bg-white/10 text-white/50 cursor-not-allowed"
          }
        `}
      >
        {canContinue ? "Continuer →" : "Remplissez tous les champs obligatoires"}
      </button>
    </div>
  );
}
