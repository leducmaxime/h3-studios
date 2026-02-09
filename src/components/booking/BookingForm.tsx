"use client";

import { ChevronLeft } from "lucide-react";
import {
  type StudioId,
  type GroupType,
  type EquipmentSelection,
  STUDIOS,
  calculatePrice,
  calculateEquipmentPrice,
  formatPrice,
  formatDate,
  formatDuration,
  TIME_SLOTS,
} from "@/lib/booking";
import { EquipmentSelector } from "./EquipmentSelector";
import { StickyBookingCTA } from "./StickyBookingCTA";

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
  equipment: EquipmentSelection[];
  onUpdateField: (field: "userName" | "userEmail" | "userPhone" | "bandName" | "billingAddress" | "billingPostalCode" | "billingCity" | "additionalInfo", value: string) => void;
  onUpdateEquipment: (equipment: EquipmentSelection[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  canConfirm: boolean;
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
  equipment,
  onUpdateField,
  onUpdateEquipment,
  onConfirm,
  onBack,
  canConfirm,
}: BookingFormProps) {
  const studio = STUDIOS[studioId];
  const { total } = calculatePrice(studioId, groupType, date, startTime, endTime);
  const duration = formatDuration(startTime, endTime);
  
  const startIdx = TIME_SLOTS.indexOf(startTime);
  const endIdx = TIME_SLOTS.indexOf(endTime);
  const durationHours = (endIdx - startIdx) * 0.5;
  const equipmentPrice = calculateEquipmentPrice(equipment, durationHours);
  const grandTotal = total + equipmentPrice;

  const groupLabels: Record<GroupType, string> = {
    solo: "Solo / Prof particulier",
    duo: "Duo",
    group: "Groupe (3+)",
  };

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-full p-2 transition-colors hover:bg-white/10"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold">Vos coordonnées</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="userName" className="text-sm font-medium text-white/70">
            Prénom et Nom <span className="text-primary">*</span>
          </label>
          <input
            id="userName"
            type="text"
            value={userName}
            onChange={(e) => onUpdateField("userName", e.target.value)}
            placeholder="Jean Dupont"
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            onChange={(e) => onUpdateField("userEmail", e.target.value)}
            placeholder="jean@exemple.fr"
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="userPhone" className="text-sm font-medium text-white/70">
            Téléphone <span className="text-primary">*</span>
          </label>
          <input
            id="userPhone"
            type="tel"
            value={userPhone}
            onChange={(e) => onUpdateField("userPhone", e.target.value)}
            placeholder="06 12 34 56 78"
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bandName" className="text-sm font-medium text-white/70">
            Nom du groupe <span className="text-white/40">(optionnel)</span>
          </label>
          <input
            id="bandName"
            type="text"
            value={bandName}
            onChange={(e) => onUpdateField("bandName", e.target.value)}
            placeholder="Les Rockers"
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-white/80">Adresse de facturation</h4>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="billingAddress" className="text-sm font-medium text-white/70">
            Nom et numéro de rue <span className="text-primary">*</span>
          </label>
          <input
            id="billingAddress"
            type="text"
            value={billingAddress}
            onChange={(e) => onUpdateField("billingAddress", e.target.value)}
            placeholder="12 Rue de la Musique"
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="billingPostalCode" className="text-sm font-medium text-white/70">
              Code postal <span className="text-primary">*</span>
            </label>
            <input
              id="billingPostalCode"
              type="text"
              value={billingPostalCode}
              onChange={(e) => onUpdateField("billingPostalCode", e.target.value)}
              placeholder="94370"
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="billingCity" className="text-sm font-medium text-white/70">
              Ville <span className="text-primary">*</span>
            </label>
            <input
              id="billingCity"
              type="text"
              value={billingCity}
              onChange={(e) => onUpdateField("billingCity", e.target.value)}
              placeholder="Sucy-en-Brie"
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          onChange={(e) => onUpdateField("additionalInfo", e.target.value)}
          placeholder="Quels instruments ? Nombre de chanteurs ? besoin de matériel ? autres infos utiles..."
          rows={3}
          className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
      </div>

      <EquipmentSelector
        equipment={equipment}
        onChange={onUpdateEquipment}
        durationHours={durationHours}
      />

      <div className="rounded-xl border border-primary/50 bg-primary/10 p-4">
        <div className="mb-3 text-sm font-semibold text-primary">Récapitulatif</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">Date</span>
            <span className="font-medium capitalize">{formatDate(date, "short")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">Horaire</span>
            <span className="font-medium">
              {startTime} - {endTime} ({duration})
            </span>
          </div>
          {groupType === "group" && (
            <div className="flex justify-between">
              <span className="text-white/70">Studio</span>
              <span className="font-medium">{studio.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-white/70">Formule</span>
            <span className="font-medium">{groupLabels[groupType]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">{groupType === "group" ? "Studio" : "Répétition"}</span>
            <span className="font-medium">{formatPrice(total)}</span>
          </div>
          {equipmentPrice > 0 && (
            <div className="flex justify-between">
              <span className="text-white/70">Équipements</span>
              <span className="font-medium">{formatPrice(equipmentPrice)}</span>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-primary/30 pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-primary">{formatPrice(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
        <p className="font-medium text-white/80">Conditions</p>
        <ul className="mt-1 space-y-0.5">
          <li>• Paiement sur place (CB, espèces)</li>
          <li>• Annulation gratuite jusqu'à 24h avant</li>
          <li>• Retard de plus de 15min = créneau annulé</li>
        </ul>
      </div>

      <button
        onClick={onConfirm}
        disabled={!canConfirm}
        className={`
          hidden w-full rounded-lg py-4 text-lg font-semibold transition-all md:block
          ${canConfirm
            ? "bg-primary text-black hover:bg-primary/90"
            : "bg-white/10 text-white/50 cursor-not-allowed"
          }
        `}
      >
        {canConfirm ? `Confirmer - ${formatPrice(grandTotal)}` : "Remplissez tous les champs"}
      </button>

      <StickyBookingCTA
        studioPrice={total}
        equipmentPrice={equipmentPrice}
        onConfirm={onConfirm}
        disabled={!canConfirm}
        buttonText={canConfirm ? "Confirmer" : "Remplissez les champs"}
      />
    </div>
  );
}
