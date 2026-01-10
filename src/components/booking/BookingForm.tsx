"use client";

import { ChevronLeft } from "lucide-react";
import {
  type StudioId,
  type GroupType,
  STUDIOS,
  calculatePrice,
  formatPrice,
  formatDate,
  formatDuration,
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
  onUpdateField: (field: "userName" | "userEmail" | "userPhone" | "bandName", value: string) => void;
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
  onUpdateField,
  onConfirm,
  onBack,
  canConfirm,
}: BookingFormProps) {
  const studio = STUDIOS[studioId];
  const { total } = calculatePrice(studioId, groupType, date, startTime, endTime);
  const duration = formatDuration(startTime, endTime);

  const groupLabels: Record<GroupType, string> = {
    solo: "Solo / Enseignant",
    duo: "Duo",
    group: "Groupe (3+)",
  };

  return (
    <div className="flex flex-col gap-6">
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

      <div className="rounded-xl border border-primary/50 bg-primary/10 p-4">
        <div className="mb-3 text-sm font-semibold text-primary">Récapitulatif</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">📅 Date</span>
            <span className="font-medium capitalize">{formatDate(date, "short")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">🕐 Horaire</span>
            <span className="font-medium">
              {startTime} - {endTime} ({duration})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">🎸 Studio</span>
            <span className="font-medium">{studio.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">👥 Formule</span>
            <span className="font-medium">{groupLabels[groupType]}</span>
          </div>
          <div className="mt-3 flex justify-between border-t border-primary/30 pt-3">
            <span className="font-semibold">💰 Total</span>
            <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-white/50">
        <p>ℹ️ Paiement sur place • Annulation gratuite 24h avant</p>
      </div>

      <button
        onClick={onConfirm}
        disabled={!canConfirm}
        className={`
          w-full rounded-lg py-4 text-lg font-semibold transition-all
          ${canConfirm
            ? "bg-primary text-black hover:bg-primary/90"
            : "bg-white/10 text-white/50 cursor-not-allowed"
          }
        `}
      >
        {canConfirm ? `Confirmer la réservation - ${formatPrice(total)}` : "Remplissez tous les champs"}
      </button>
    </div>
  );
}
