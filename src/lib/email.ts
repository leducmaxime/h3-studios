import { type BookingEquipmentLine, formatPrice, resolveEquipmentDisplay } from "@/lib/booking";
import { offeredUnitsSuffix } from "@/lib/equipment-pricing";
import { CLIENT_TYPE_RULES, isClientType } from "@/lib/booking-fields";
import { groupTypeLabel, paymentMethodLabel, studioLabel } from "@/lib/labels";
import { formatEuro, splitTtc } from "@/lib/tax";
import { COMPANY } from "@/lib/company";

export interface BookingSlot {
  bookingRef: string;
  studioId: string;
  date: string;
  startTime: string;
  endTime: string;
  groupType: string;
  equipment: BookingEquipmentLine[];
  equipmentPrice: number;
  equipmentNames?: Record<string, string>;
  totalPrice: number;
}

export interface BookingCancellationData {
  bookingRef: string;
  studioId: string;
  date: string;
  startTime: string;
  endTime: string;
  userName: string;
  userEmail: string;
  keepBalanceDue: boolean;
  remaining: number;
  reason?: string;
}

export interface BookingConfirmationData {
  // Primary slot (kept for backward compat with single-booking)
  bookingRef: string;
  studioId: string;
  date: string;
  startTime: string;
  endTime: string;
  groupType: string;
  equipment: BookingEquipmentLine[];
  equipmentPrice: number;
  equipmentNames?: Record<string, string>;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  clientType?: string;
  legalName?: string;
  promoCode?: string | null;
  promoDiscount?: number;
  promoType?: string | null;
  promoValue?: number; // Valeur brute du code promo (pourcentage ou montant fixe)
  loyaltyDiscount?: number;
  // Multi-booking: all slots in the cart
  allSlots?: BookingSlot[];
}

function formatDateFrench(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTimeRange(startTime: string, endTime: string): string {
  if (endTime === "00:00") {
    return `${startTime} → 00:00`;
  }
  return `${startTime} → ${endTime}`;
}

function getGroupTypeLabel(groupType: string): string {
  return groupTypeLabel(groupType, { long: true });
}

function getPaymentMethodLabel(method: string, status: string, totalPrice = 0): string {
  if (totalPrice === 0) {
    return "Gratuit — réduction intégrale appliquée";
  }
  if (method === "card" && status === "pending") {
    return "Paiement en ligne (en cours)";
  }
  if (method === "card" && status === "paid") {
    return "Carte bancaire";
  }
  if (method === "cash" || status === "pay-on-site") {
    return "Paiement sur place (espèces ou CB)";
  }
  return paymentMethodLabel(method);
}

function getStudioName(studioId: string): string {
  return studioLabel(studioId);
}

function calculateDurationHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let duration = (endH + endM / 60) - (startH + startM / 60);
  if (duration <= 0) duration += 24; // handle midnight crossing
  return duration;
}

function buildEquipmentList(equipment: BookingEquipmentLine[]): string {
  if (!equipment || equipment.length === 0) {
    return "Aucun matériel supplémentaire";
  }
  return equipment
    .map((item) => {
      let label = `${item.name || item.id} ×${item.quantity}`;
      if (item.offeredUnits?.length) {
        label += ` (${offeredUnitsSuffix(item.offeredUnits)})`;
      }
      return label;
    })
    .filter(Boolean)
    .join(", ");
}

function buildEquipmentBreakdown(equipment: BookingEquipmentLine[] | string | null | undefined, equipmentPrice: number, names?: Record<string, string>): string {
  const display = resolveEquipmentDisplay(equipment, equipmentPrice, id => names?.[id]);
  if (display.lines.length === 0 && display.subtotal <= 0) {
    return "";
  }
  if (!display.showLinePrices) return `<tr><td style="padding:4px 0;color:#aaaaaa;font-size:13px;">Équipements</td><td align="right" style="padding:4px 0;color:#ffffff;font-size:13px;font-weight:500;">${formatPrice(display.subtotal)}</td></tr>`;
  return display.lines
    .map((item) => {
      const price = item.lineTotal;
      let label = `${item.name || item.id} ×${item.quantity}`;
      if (item.offeredUnits?.length) {
        label += ` — ${offeredUnitsSuffix(item.offeredUnits)}`;
      }
      return `<tr>
        <td style="padding:4px 0;color:#aaaaaa;font-size:13px;">${label}</td>
        <td align="right" style="padding:4px 0;color:#ffffff;font-size:13px;font-weight:500;">${typeof price === "number" && Number.isFinite(price) ? formatPrice(price) : ""}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join("");
}

export function buildEmailHtml(data: BookingConfirmationData): string {
  const studioName = getStudioName(data.studioId);
  const dateLabel = formatDateFrench(data.date);
  const timeLabel = formatTimeRange(data.startTime, data.endTime);
  const groupLabel = getGroupTypeLabel(data.groupType);
  const paymentLabel = getPaymentMethodLabel(data.paymentMethod, data.paymentStatus, data.totalPrice);
  const equipmentLabel = buildEquipmentList(data.equipment);
  const hasPromo = data.promoCode && (data.promoDiscount || 0) > 0;
  const promoLabel = data.promoType === "percentage" ? `${data.promoValue ?? data.promoDiscount}%` : `${formatPrice(data.promoDiscount || 0)}`;
  const equipmentBreakdown = buildEquipmentBreakdown(data.equipment, data.equipmentPrice, data.equipmentNames);
  const clientTypeLabel = isClientType(data.clientType) ? CLIENT_TYPE_RULES[data.clientType].label : data.clientType;
  const clientIdentitySection = data.clientType
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background-color:#111111;"><tr><td style="padding:4px 0;"><span style="color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Type de client</span><br><span style="color:#ffffff;font-size:13px;">${clientTypeLabel}</span>${data.clientType !== "particulier" && data.legalName ? `<br><span style="color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Raison sociale</span><br><span style="color:#ffffff;font-size:13px;">${data.legalName}</span>` : ""}</td></tr></table>`
    : "";

  const isMultiSlot = data.allSlots && data.allSlots.length > 1;
  const multiSlotTotal = isMultiSlot ? data.allSlots!.reduce((sum, s) => sum + s.totalPrice, 0) : 0;
  const multiNetTotal = Math.max(0, multiSlotTotal - (data.promoDiscount || 0) - (data.loyaltyDiscount || 0));
  const multiTax = splitTtc(multiNetTotal);
  const singleTax = splitTtc(data.totalPrice);

  const bookingRefBadge = isMultiSlot
    ? `<p style="margin:0 0 4px 0;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Références de réservation</p>
${data.allSlots!.map((s, i) => `<p style="margin:${i === 0 ? "0" : "4px 0 0 0"};color:#facc15;font-size:16px;font-weight:700;letter-spacing:1px;font-family:'Courier New',monospace;">${s.bookingRef}</p>`).join("\n")}`
    : `<p style="margin:0 0 4px 0;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Référence de réservation</p>
<p style="margin:0;color:#facc15;font-size:24px;font-weight:700;letter-spacing:1px;font-family:'Courier New',monospace;">${data.bookingRef}</p>`;

  // Multi-slot: one card per slot with its own price breakdown + equipment
  const multiSlotCards = isMultiSlot ? data.allSlots!.map((slot, idx) => {
    const slotEquipBreakdown = buildEquipmentBreakdown(slot.equipment, slot.equipmentPrice, slot.equipmentNames || data.equipmentNames);
    const slotEquipLabel = buildEquipmentList(slot.equipment);
    const slotStudio = getStudioName(slot.studioId);
    const slotBasePrice = slot.totalPrice - slot.equipmentPrice;
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border:1px solid #2a2a2a;border-radius:10px;overflow:hidden;">
  <tr>
    <td style="background-color:#1a1a1a;padding:12px 16px;border-bottom:1px solid #2a2a2a;">
      <p style="margin:0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Créneau ${idx + 1} · <span style="color:#facc15;font-family:'Courier New',monospace;">${slot.bookingRef}</span></p>
    </td>
  </tr>
  <tr>
    <td style="padding:14px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
        <tr>
          <td width="50%" style="padding-bottom:8px;">
            <p style="margin:0 0 2px 0;color:#666666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Studio</p>
            <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;">${slotStudio}</p>
          </td>
          <td width="50%" style="padding-bottom:8px;">
            <p style="margin:0 0 2px 0;color:#666666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Type</p>
            <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;">${getGroupTypeLabel(slot.groupType)}</p>
          </td>
        </tr>
        <tr>
          <td width="50%">
            <p style="margin:0 0 2px 0;color:#666666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Date</p>
            <p style="margin:0;color:#ffffff;font-size:13px;">${formatDateFrench(slot.date)}</p>
          </td>
          <td width="50%">
            <p style="margin:0 0 2px 0;color:#666666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Horaire</p>
            <p style="margin:0;color:#ffffff;font-size:13px;">${formatTimeRange(slot.startTime, slot.endTime)}</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #2a2a2a;padding-top:10px;">
        <tr>
          <td style="padding:3px 0;color:#aaaaaa;font-size:12px;">Répétition (${slotStudio})</td>
          <td align="right" style="padding:3px 0;color:#ffffff;font-size:12px;">${formatPrice(slotBasePrice)}</td>
        </tr>
        ${slotEquipBreakdown ? `
        ${slotEquipBreakdown}
        ` : `
        <tr>
          <td style="padding:3px 0;color:#555555;font-size:12px;">Aucun matériel supplémentaire</td>
          <td></td>
        </tr>
        `}
        <tr>
          <td style="padding:6px 0 2px 0;color:#ffffff;font-size:13px;font-weight:600;border-top:1px solid #2a2a2a;">Sous-total</td>
          <td align="right" style="padding:6px 0 2px 0;color:#facc15;font-size:13px;font-weight:700;border-top:1px solid #2a2a2a;">${formatPrice(slot.totalPrice)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }).join("") : "";

  const detailsGrid = isMultiSlot
    ? multiSlotCards
    : `<tr>
  <td width="50%" valign="top" style="padding-right:8px;padding-bottom:16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
      <tr>
        <td>
          <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Studio</p>
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${studioName}</p>
        </td>
      </tr>
    </table>
  </td>
  <td width="50%" valign="top" style="padding-left:8px;padding-bottom:16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
      <tr>
        <td>
          <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Type</p>
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${groupLabel}</p>
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr>
  <td width="50%" valign="top" style="padding-right:8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
      <tr>
        <td>
          <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Date</p>
          <p style="margin:0;color:#ffffff;font-size:15px;font-weight:500;">${dateLabel}</p>
        </td>
      </tr>
    </table>
  </td>
  <td width="50%" valign="top" style="padding-left:8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
      <tr>
        <td>
          <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Horaire</p>
          <p style="margin:0;color:#ffffff;font-size:15px;font-weight:500;">${timeLabel}</p>
        </td>
      </tr>
    </table>
  </td>
</tr>`;

  // Multi-slot: equipment is shown per-slot in the cards above — no separate section needed
  const equipmentSection = isMultiSlot
    ? ""
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
  <tr>
    <td style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
      <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Matériel supplémentaire</p>
      <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.5;">${equipmentLabel}</p>
    </td>
  </tr>
</table>`;

  const priceBreakdown = isMultiSlot
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;border-top:2px solid #333333;padding-top:20px;">
  <tr>
    <td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${hasPromo ? `
        <tr>
          <td style="padding:6px 0;color:#facc15;font-size:14px;">
            Code promo <strong>${data.promoCode}</strong> (-${promoLabel})
          </td>
          <td align="right" style="padding:6px 0;color:#facc15;font-size:14px;font-weight:500;">-${formatPrice(data.promoDiscount || 0)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border-top:1px solid #333333;padding-top:8px;"></td>
        </tr>
        ` : ""}
        ${(data.loyaltyDiscount || 0) > 0 ? `<tr><td style="padding:6px 0;color:#facc15;font-size:14px;">Ristourne fidélité</td><td align="right">-${formatPrice(data.loyaltyDiscount || 0)}</td></tr>` : ""}
        ${multiNetTotal === 0 ? "" : `<tr><td style="padding:3px 0;color:#aaaaaa;font-size:13px;">HT</td><td align="right" style="padding:3px 0;color:#aaaaaa;font-size:13px;">${formatEuro(multiTax.ht)}</td></tr>
        <tr><td style="padding:3px 0;color:#aaaaaa;font-size:13px;">TVA 20%</td><td align="right" style="padding:3px 0;color:#aaaaaa;font-size:13px;">${formatEuro(multiTax.vat)}</td></tr>`}
        <tr>
          <td style="padding:6px 0;color:#ffffff;font-size:17px;font-weight:700;">${multiNetTotal === 0 ? `Total (${data.allSlots!.length} créneaux)` : `Total TTC (${data.allSlots!.length} créneaux)`}</td>
          <td align="right" style="padding:6px 0;color:#facc15;font-size:22px;font-weight:700;">${multiNetTotal === 0 ? '<span style="color:#22c55e;">GRATUIT</span>' : formatPrice(multiNetTotal)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;border-top:1px solid #333333;padding-top:20px;">
  <tr>
    <td>
      <p style="margin:0 0 12px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Récapitulatif</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:6px 0;color:#aaaaaa;font-size:14px;">Répétition (${studioName})</td>
          <td align="right" style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:500;">${formatPrice(data.totalPrice - data.equipmentPrice + (data.promoDiscount || 0) + (data.loyaltyDiscount || 0))}</td>
        </tr>
        ${equipmentBreakdown}
        ${hasPromo ? `
        <tr>
          <td style="padding:6px 0;color:#facc15;font-size:14px;">
            Code promo <strong>${data.promoCode}</strong> (-${promoLabel})
          </td>
          <td align="right" style="padding:6px 0;color:#facc15;font-size:14px;font-weight:500;">-${formatPrice(data.promoDiscount || 0)}</td>
        </tr>
        ` : ""}
        ${(data.loyaltyDiscount || 0) > 0 ? `<tr><td style="padding:6px 0;color:#facc15;font-size:14px;">Ristourne fidélité</td><td align="right">-${formatPrice(data.loyaltyDiscount || 0)}</td></tr>` : ""}
        <tr>
          <td colspan="2" style="border-top:1px solid #333333;padding-top:12px;"></td>
        </tr>
        ${data.totalPrice === 0 ? "" : `<tr><td style="padding:3px 0;color:#aaaaaa;font-size:13px;">HT</td><td align="right" style="padding:3px 0;color:#aaaaaa;font-size:13px;">${formatEuro(singleTax.ht)}</td></tr>
        <tr><td style="padding:3px 0;color:#aaaaaa;font-size:13px;">TVA 20%</td><td align="right" style="padding:3px 0;color:#aaaaaa;font-size:13px;">${formatEuro(singleTax.vat)}</td></tr>`}
        <tr>
          <td style="padding:6px 0;color:#ffffff;font-size:16px;font-weight:600;">${data.totalPrice === 0 ? "Total" : "Total TTC"}</td>
          <td align="right" style="padding:6px 0;color:#facc15;font-size:20px;font-weight:700;">${data.totalPrice === 0 ? '<span style="color:#22c55e;">GRATUIT</span>' : formatPrice(data.totalPrice)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

  const greetingLine = isMultiSlot
    ? `Bonjour ${data.userName},<br>
Nous avons bien enregistré vos <strong>${data.allSlots!.length} réservations</strong>. Voici les détails :`
    : `Bonjour ${data.userName},<br>
Nous avons bien enregistré votre réservation. Voici les détails :`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de réservation - H3 Studios</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#111111;border-radius:16px;overflow:hidden;border:1px solid #222222;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a1a 0%,#0a0a0a 100%);padding:40px 30px;text-align:center;border-bottom:2px solid #facc15;">
              <img src="${COMPANY.siteUrl}/images/logo-email.png" alt="H3 Studios" width="180" style="display:block;margin:0 auto 12px;" />

            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:40px 30px 30px 30px;">
              <h2 style="margin:0 0 8px 0;color:#ffffff;font-size:22px;font-weight:600;">${isMultiSlot ? "Vos réservations sont confirmées !" : "Votre réservation est confirmée !"}</h2>
              <p style="margin:0 0 30px 0;color:#aaaaaa;font-size:15px;line-height:1.6;">
                ${greetingLine}
              </p>

              <!-- Booking Ref Badge -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
                <tr>
                  <td style="background-color:#1a1a1a;border:1px solid #333333;border-radius:12px;padding:20px;text-align:center;">
                    ${bookingRefBadge}
                  </td>
                </tr>
              </table>

              <!-- Details Grid -->
              ${isMultiSlot
                ? `<div style="margin-bottom:20px;">${detailsGrid}</div>`
                : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">${detailsGrid}</table>`
              }

              ${clientIdentitySection}

              <!-- Equipment -->
              ${equipmentSection}

              <!-- Price Breakdown -->
              ${priceBreakdown}

              <!-- Payment Method -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
                <tr>
                  <td style="background-color:#1a1a1a;border-radius:10px;padding:16px;border-left:3px solid #facc15;">
                    <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Mode de paiement</p>
                    <p style="margin:0;color:#ffffff;font-size:15px;font-weight:500;">${paymentLabel}</p>
                  </td>
                </tr>
              </table>

              <!-- Important Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#1a1500;border-radius:10px;padding:16px;border:1px solid #332200;">
                    <p style="margin:0 0 8px 0;color:#facc15;font-size:13px;font-weight:600;">📍 Informations importantes</p>
                    <p style="margin:0;color:#aaaaaa;font-size:13px;line-height:1.6;">
                      <strong style="color:#ffffff;">Adresse :</strong> <a href="https://maps.google.com/?q=3+Rue+de+la+Grande+Ceinture+94370+Sucy-en-Brie" style="color:#facc15;text-decoration:none;">3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie</a><br>
                      <strong style="color:#ffffff;">Accès :</strong> RER A - Gare de Sucy - Bonneuil (2 min à pied)<br>
                      <strong style="color:#ffffff;">Modification / Annulation :</strong> pour toute modification, veuillez nous contacter au plus tôt au <a href="tel:+33613440875" style="color:#facc15;text-decoration:none;">06.13.44.08.75</a>. Nous vous demandons de nous prévenir le plus tôt possible afin de libérer le créneau pour d'autres musiciens. À noter : toute annulation effectuée moins de 24 heures avant le début de la réservation est non remboursable. Si vous avez choisi le paiement sur place, le montant de la réservation reste intégralement dû.<br>
                      <strong style="color:#ffffff;">Horaire :</strong> merci de respecter votre créneau de réservation.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0a0a0a;padding:30px;text-align:center;border-top:1px solid #222222;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px auto;">
                <tr>
                  <td style="background-color:#111111;border:1px solid #facc15;border-radius:10px;padding:16px 24px;text-align:center;">
                    <a href="https://www.instagram.com/h3_studios_sucy/" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 8px auto;">
                        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                      </svg>
                      <span style="display:block;color:#facc15;font-size:15px;font-weight:700;margin-bottom:4px;">Suivez-nous sur Instagram</span>
                      <span style="display:block;color:#aaaaaa;font-size:12px;">@h3_studios_sucy &mdash; coulisses, artistes &amp; actus</span>
                    </a>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px auto;">
                <tr>
                  <td style="background-color:#111111;border:1px solid #facc15;border-radius:10px;padding:16px 24px;text-align:center;">
                    <p style="margin:0 0 4px 0;color:#facc15;font-size:15px;font-weight:700;">Après votre séance</p>
                    <p style="margin:0 0 12px 0;color:#aaaaaa;font-size:12px;">Votre avis Google aide d'autres musiciens à nous trouver.</p>
                    <table border="0" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                      <tr>
                        <td align="center" bgcolor="#facc15" style="border-radius:8px;padding:10px 18px;">
                          <a href="https://search.google.com/local/writereview?placeid=ChIJi9IayzcL5kcRKCQIsydm0kA" target="_blank" rel="noopener noreferrer" style="display:block;font-size:13px;font-weight:700;color:#0a0a0a;text-decoration:none;">Laisser un avis Google</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px 0;">
                <a href="https://www.facebook.com/profile.php?id=100089893392179" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px;text-decoration:none;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                  </svg>
                </a>
              </p>
              <p style="margin:0;color:#444444;font-size:11px;">
                <a href="${COMPANY.siteUrl}" style="color:#888888;text-decoration:none;">${COMPANY.siteHost}</a> &nbsp;|&nbsp;
                <a href="mailto:contact@h3-studios.fr" style="color:#888888;text-decoration:none;">contact@h3-studios.fr</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function buildCancellationEmailHtml(data: BookingCancellationData): string {
  const studioName = getStudioName(data.studioId);
  const dateLabel = formatDateFrench(data.date);
  const timeLabel = formatTimeRange(data.startTime, data.endTime);
  const greeting = data.userName ? `Bonjour ${data.userName},` : "Bonjour,";
  const dueBlock = data.keepBalanceDue && data.remaining > 0.005
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;background-color:#2a1a00;border:1px solid #facc15;border-radius:10px;">
        <tr>
          <td style="padding:16px;">
            <p style="margin:0 0 6px 0;color:#facc15;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Montant dû</p>
            <p style="margin:0 0 8px 0;color:#ffffff;font-size:22px;font-weight:700;">${formatPrice(data.remaining)}</p>
            <p style="margin:0;color:#dddddd;font-size:13px;line-height:1.5;">
              Votre réservation est annulée, mais ce montant reste intégralement dû.
              Vous pouvez le régler sur place ou nous contacter au
              <a href="tel:+33613440875" style="color:#facc15;text-decoration:none;">06.13.44.08.75</a>.
            </p>
          </td>
        </tr>
      </table>`
    : `<p style="margin:0 0 24px 0;color:#aaaaaa;font-size:14px;line-height:1.6;">Aucun montant n'est dû pour cette réservation annulée.</p>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réservation annulée — H3 Studios</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0;color:#facc15;font-size:12px;text-transform:uppercase;letter-spacing:2px;">H3 Studios</p>
              <h1 style="margin:8px 0 0 0;color:#ffffff;font-size:24px;">Réservation annulée</h1>
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin:0 0 16px 0;color:#dddddd;font-size:15px;">${greeting}</p>
              <p style="margin:0 0 24px 0;color:#aaaaaa;font-size:14px;line-height:1.6;">
                La réservation <span style="color:#facc15;font-family:'Courier New',monospace;font-weight:700;">${data.bookingRef}</span>
                (${studioName} · ${dateLabel} · ${timeLabel}) a été annulée.
              </p>
              ${dueBlock}
              <p style="margin:0;color:#666666;font-size:12px;">
                Une question ? Écrivez-nous à
                <a href="mailto:contact@h3-studios.fr" style="color:#888888;text-decoration:none;">contact@h3-studios.fr</a>
                ou appelez le 06.13.44.08.75.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendBookingCancellationEmail(
  apiKey: string,
  data: BookingCancellationData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = buildCancellationEmailHtml(data);
    const subject = data.keepBalanceDue && data.remaining > 0.005
      ? `Réservation annulée — ${formatPrice(data.remaining)} restant dû — H3 Studios`
      : `Réservation annulée — ${data.bookingRef} — H3 Studios`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "H3 Studios <contact@h3-studios.fr>",
        to: data.userEmail,
        subject,
        html,
        reply_to: "contact@h3-studios.fr",
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("Resend API error (booking cancellation):", errorData);
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending booking cancellation email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function sendBookingConfirmationEmail(
  apiKey: string,
  data: BookingConfirmationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = buildEmailHtml(data);
    const isMultiSlot = data.allSlots && data.allSlots.length > 1;
    const subject = isMultiSlot
      ? `✅ ${data.allSlots!.length} réservations confirmées — H3 Studios`
      : `✅ Réservation confirmée — ${formatDateShort(data.date)} · ${data.startTime}→${data.endTime === "00:00" ? "00:00" : data.endTime} — H3 Studios`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "H3 Studios <contact@h3-studios.fr>",
        to: data.userEmail,
        subject,
        html,
        reply_to: "contact@h3-studios.fr",
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("Resend API error (booking confirmation):", errorData);
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending booking confirmation email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Envoie un email de création/réinitialisation de mot de passe via Resend.
 * Utilisé à la fois par le flux de réservation (création de compte) et
 * par la page mot-de-passe-oublie.
 *
 * @param apiKey - Clé API Resend
 * @param to - Email du destinataire
 * @param name - Prénom/nom du destinataire (pour la personnalisation)
 * @param resetUrl - URL complète de réinitialisation
 * @param subject - Sujet de l'email (défaut : "Créez votre mot de passe H3 Studios")
 * @returns Success ou erreur
 */
export async function sendPasswordResetEmail(
  apiKey: string,
  to: string,
  name: string,
  resetUrl: string,
  subject = "Créez votre mot de passe H3 Studios",
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailHtml = `
      <h2>${subject}</h2>
      <p>Bonjour ${name},</p>
      <p>Vous avez demandé à créer ou réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous :</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Ce lien est valable pendant 1 heure.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "H3 Studios <contact@h3-studios.fr>",
        to,
        subject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("Resend API error (password reset):", errorData);
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
