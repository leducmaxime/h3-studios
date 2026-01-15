"use client";

import { useState } from "react";
import { CreditCard, Lock, ShieldCheck, ChevronLeft, Loader2, ExternalLink } from "lucide-react";
import { formatPrice, type CompletedBooking, STUDIOS, formatDate } from "@/lib/booking";

interface StripeRedirectProps {
  cart: CompletedBooking[];
  total: number;
  userName: string;
  userEmail: string;
  onBack: () => void;
}

export function StripeRedirect({ cart, total, userName, userEmail, onBack }: StripeRedirectProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const nameParts = userName.trim().split(" ");
      const firstName = nameParts[0] || "Client";
      const lastName = nameParts.slice(1).join(" ") || "H3";

      localStorage.setItem("h3-pending-payment", JSON.stringify({
        refs: cart.map(b => b.bookingRef),
        email: userEmail,
        total,
      }));

      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          firstName,
          lastName,
          email: userEmail,
          bookingRefs: cart.map(b => b.bookingRef),
        }),
      });

      const data = await response.json() as { error?: string; paymentUrl?: string };

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création du paiement");
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="rounded-full p-2 transition-colors hover:bg-white/10 disabled:opacity-50"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-xl font-semibold">Paiement sécurisé</h3>
          <p className="text-sm text-white/60">Paiement via Stripe</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Paiement par carte</h4>
                <p className="text-sm text-white/60">Visa, Mastercard, CB, Amex</p>
              </div>
            </div>

            <p className="mb-6 text-sm text-white/70">
              Vous allez être redirigé vers notre partenaire de paiement sécurisé 
              <strong className="text-primary"> Stripe</strong> pour finaliser votre règlement.
            </p>

            <ul className="mb-6 space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-400" />
                <span>Paiement 100% sécurisé (SSL/TLS)</span>
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-green-400" />
                <span>Vos données bancaires ne sont jamais stockées</span>
              </li>
              <li className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-green-400" />
                <span>3D Secure pour une sécurité renforcée</span>
              </li>
            </ul>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className={`
                w-full flex items-center justify-center gap-2 rounded-lg py-4 text-lg font-semibold transition-all
                ${!isProcessing
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "bg-white/10 text-white/50 cursor-not-allowed"
                }
              `}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Redirection en cours...
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  Payer {formatPrice(total)}
                </>
              )}
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/40">
              <ShieldCheck className="h-4 w-4" />
              <span>Paiement sécurisé par Stripe</span>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h4 className="mb-4 font-semibold">Récapitulatif de commande</h4>
            
            <div className="space-y-3">
              {cart.map((booking) => (
                <div key={booking.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{STUDIOS[booking.studioId].name}</p>
                    <p className="text-white/50">
                      {formatDate(booking.date, "short")} - {booking.startTime}-{booking.endTime}
                    </p>
                  </div>
                  <span className="font-medium">{formatPrice(booking.price + booking.equipmentPrice)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between border-t border-white/10 pt-4">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
            </div>

            <p className="mt-4 text-xs text-white/40">
              Un reçu sera envoyé à {userEmail}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-6">
            <svg className="h-8 opacity-60" viewBox="0 0 60 25" fill="currentColor">
              <path d="M24.5 3.5H35.5V21.5H24.5V3.5Z" fill="#FF5F00"/>
              <path d="M25.5 12.5C25.5 8.9 27.2 5.7 29.9 3.5C27.4 1.6 24.3 0.5 21 0.5C12.2 0.5 5 7.1 5 15.5C5 23.9 12.2 24.5 21 24.5C24.3 24.5 27.4 23.4 29.9 21.5C27.2 19.3 25.5 16.1 25.5 12.5Z" fill="#EB001B"/>
              <path d="M55 12.5C55 20.9 47.8 24.5 39 24.5C35.7 24.5 32.6 23.4 30.1 21.5C32.8 19.3 34.5 16.1 34.5 12.5C34.5 8.9 32.8 5.7 30.1 3.5C32.6 1.6 35.7 0.5 39 0.5C47.8 0.5 55 7.1 55 12.5Z" fill="#F79E1B"/>
            </svg>
            <svg className="h-5 opacity-60" viewBox="0 0 50 16" fill="currentColor">
              <path d="M19.5 0.5L15 15.5H11L15.5 0.5H19.5ZM37 10.5L39 4.5L40 10.5H37ZM41.5 15.5H45L42 0.5H38.5C37.5 0.5 36.5 1 36.5 2L31 15.5H35L36 13H40.5L41.5 15.5ZM32.5 10.5C32.5 5.5 26 5 26 3C26 2 27 1.5 28.5 1.5C30 1.5 31.5 2 32 2.5L32.5 0.5C31.5 0.5 29.5 0 28 0C24.5 0 22 2 22 4.5C22 8 26 8.5 26 10.5C26 11.5 25 12 23.5 12C21.5 12 20 11 19.5 11L19 13C20 13.5 22 14 23.5 14C27.5 14 32.5 12.5 32.5 10.5ZM11 0.5L6.5 11L6 9C5 6.5 2.5 4 0 2.5L4 15.5H8L15 0.5H11Z"/>
            </svg>
            <svg className="h-6 opacity-60" viewBox="0 0 32 20" fill="currentColor">
              <path d="M0 4C0 1.8 1.8 0 4 0H28C30.2 0 32 1.8 32 4V16C32 18.2 30.2 20 28 20H4C1.8 20 0 18.2 0 16V4Z"/>
              <path d="M12 14.5C14.5 14.5 16.5 12.5 16.5 10C16.5 7.5 14.5 5.5 12 5.5C9.5 5.5 7.5 7.5 7.5 10C7.5 12.5 9.5 14.5 12 14.5Z" fill="#EB001B"/>
              <path d="M20 14.5C22.5 14.5 24.5 12.5 24.5 10C24.5 7.5 22.5 5.5 20 5.5C17.5 5.5 15.5 7.5 15.5 10C15.5 12.5 17.5 14.5 20 14.5Z" fill="#F79E1B"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
