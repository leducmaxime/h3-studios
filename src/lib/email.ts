import { type EquipmentSelection, STUDIOS, EQUIPMENT, formatPrice } from "@/lib/booking";

export interface BookingConfirmationData {
  bookingRef: string;
  studioId: string;
  date: string;
  startTime: string;
  endTime: string;
  groupType: string;
  equipment: EquipmentSelection[];
  equipmentPrice: number;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  promoCode?: string | null;
  promoDiscount?: number;
  promoType?: string | null;
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
  const labels: Record<string, string> = {
    solo: "Solo / Prof particulier",
    duo: "Duo",
    group: "Groupe (3+)",
  };
  return labels[groupType] || groupType;
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
  return method;
}

function getStudioName(studioId: string): string {
  return STUDIOS[studioId as keyof typeof STUDIOS]?.name || studioId;
}

function calculateDurationHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let duration = (endH + endM / 60) - (startH + startM / 60);
  if (duration <= 0) duration += 24; // handle midnight crossing
  return duration;
}

function buildEquipmentList(equipment: EquipmentSelection[]): string {
  if (!equipment || equipment.length === 0) {
    return "Aucun matériel supplémentaire";
  }
  return equipment
    .map((item) => {
      const eq = EQUIPMENT[item.id as keyof typeof EQUIPMENT];
      if (!eq) return null;
      let label = `${eq.name} ×${item.quantity}`;
      if (item.id === "mic" && item.quantity === 4) {
        label += " (4ème offert)";
      }
      return label;
    })
    .filter(Boolean)
    .join(", ");
}

function buildEquipmentBreakdown(equipment: EquipmentSelection[], durationHours: number): string {
  if (!equipment || equipment.length === 0) {
    return "";
  }
  return equipment
    .map((item) => {
      const eq = EQUIPMENT[item.id as keyof typeof EQUIPMENT];
      if (!eq) return null;
      let price = 0;
      if (eq.pricingType === "session" && eq.sessionPricing) {
        price = eq.sessionPricing[item.quantity - 1] || 0;
      } else {
        price = eq.pricePerHour * item.quantity * durationHours;
      }
      let label = `${eq.name} ×${item.quantity}`;
      if (item.id === "mic" && item.quantity === 4) {
        label += " — 4ème offert";
      }
      return `<tr>
        <td style="padding:4px 0;color:#aaaaaa;font-size:13px;">${label}</td>
        <td align="right" style="padding:4px 0;color:#ffffff;font-size:13px;font-weight:500;">${formatPrice(price)}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join("");
}

function buildEmailHtml(data: BookingConfirmationData): string {
  const studioName = getStudioName(data.studioId);
  const dateLabel = formatDateFrench(data.date);
  const timeLabel = formatTimeRange(data.startTime, data.endTime);
  const groupLabel = getGroupTypeLabel(data.groupType);
  const paymentLabel = getPaymentMethodLabel(data.paymentMethod, data.paymentStatus, data.totalPrice);
  const equipmentLabel = buildEquipmentList(data.equipment);
  const hasPromo = data.promoCode && (data.promoDiscount || 0) > 0;
  const promoLabel = data.promoType === "percentage" ? `${data.promoDiscount}%` : `${formatPrice(data.promoDiscount || 0)}`;
  const durationHours = calculateDurationHours(data.startTime, data.endTime);
  const isGroup = data.groupType === "group";
  const equipmentBreakdown = buildEquipmentBreakdown(data.equipment, durationHours);

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
              <img src="https://staging.h3-studios.fr/images/logo-email.png" alt="H3 Studios" width="180" style="display:block;margin:0 auto 12px;" />

            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding:40px 30px 30px 30px;">
              <h2 style="margin:0 0 8px 0;color:#ffffff;font-size:22px;font-weight:600;">Votre réservation est confirmée !</h2>
              <p style="margin:0 0 30px 0;color:#aaaaaa;font-size:15px;line-height:1.6;">
                Bonjour ${data.userName},<br>
                Nous avons bien enregistré votre réservation. Voici les détails :
              </p>
              
              <!-- Booking Ref Badge -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
                <tr>
                  <td style="background-color:#1a1a1a;border:1px solid #333333;border-radius:12px;padding:20px;text-align:center;">
                    <p style="margin:0 0 4px 0;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Référence de réservation</p>
                    <p style="margin:0;color:#facc15;font-size:24px;font-weight:700;letter-spacing:1px;font-family:'Courier New',monospace;">${data.bookingRef}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Details Grid -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
                ${isGroup ? `
                <tr>
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
                </tr>
                ` : `
                <tr>
                  <td width="50%" valign="top" style="padding-right:8px;padding-bottom:16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Type</p>
                          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;">${groupLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding-left:8px;padding-bottom:16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Horaire</p>
                          <p style="margin:0;color:#ffffff;font-size:15px;font-weight:500;">${timeLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="100%" valign="top" colspan="2">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Date</p>
                          <p style="margin:0;color:#ffffff;font-size:15px;font-weight:500;">${dateLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `}
              </table>
              
              <!-- Equipment -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#1a1a1a;border-radius:10px;padding:16px;">
                    <p style="margin:0 0 4px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Matériel supplémentaire</p>
                    <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.5;">${equipmentLabel}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Price Breakdown -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;border-top:1px solid #333333;padding-top:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 12px 0;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Récapitulatif</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:6px 0;color:#aaaaaa;font-size:14px;">Répétition${isGroup ? ` (${studioName})` : ""}</td>
                        <td align="right" style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:500;">${formatPrice(data.totalPrice - data.equipmentPrice + (data.promoDiscount || 0))}</td>
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
                      <tr>
                        <td colspan="2" style="border-top:1px solid #333333;padding-top:12px;"></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#ffffff;font-size:16px;font-weight:600;">Total</td>
                        <td align="right" style="padding:6px 0;color:#facc15;font-size:20px;font-weight:700;">${data.totalPrice === 0 ? '<span style="color:#22c55e;">GRATUIT</span>' : formatPrice(data.totalPrice)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
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
                      <strong style="color:#ffffff;">Modification :</strong> pour toute modification, veuillez nous contacter au plus tôt au <a href="tel:+33613440875" style="color:#facc15;text-decoration:none;">06.13.44.08.75</a>.<br>
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
              <p style="margin:0 0 16px 0;color:#555555;font-size:12px;">3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie</p>
              <p style="margin:0 0 20px 0;color:#aaaaaa;font-size:13px;line-height:1.5;">
                Suivez-nous sur <a href="https://www.instagram.com/h3_studios_sucy/" target="_blank" rel="noopener noreferrer" style="color:#facc15;text-decoration:none;font-weight:600;">Instagram @h3_studios_sucy</a> pour découvrir nos actualités, les coulisses des studios et les artistes qui répètent chez nous !
              </p>
              <p style="margin:0 0 16px 0;">
                <a href="https://www.instagram.com/h3_studios_sucy/" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px;text-decoration:none;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                  </svg>
                </a>
                <a href="https://www.facebook.com/profile.php?id=100089893392179" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px;text-decoration:none;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                  </svg>
                </a>
              </p>
              <p style="margin:0;color:#444444;font-size:11px;">
                <a href="https://staging.h3-studios.fr" style="color:#888888;text-decoration:none;">h3-studios.fr</a> &nbsp;|&nbsp;
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

export async function sendBookingConfirmationEmail(
  apiKey: string,
  data: BookingConfirmationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = buildEmailHtml(data);
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "H3 Studios <contact@h3-studios.fr>",
        to: data.userEmail,
        subject: `✅ Réservation confirmée — ${formatDateShort(data.date)} · ${data.startTime}→${data.endTime === '00:00' ? '00:00' : data.endTime} — H3 Studios`,
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
