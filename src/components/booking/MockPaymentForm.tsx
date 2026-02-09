"use client";

import { useState, useCallback } from "react";
import { CreditCard, Lock, ShieldCheck, ChevronLeft, Loader2 } from "lucide-react";
import { formatPrice, type CompletedBooking, STUDIOS, formatDate, formatDuration } from "@/lib/booking";

interface MockPaymentFormProps {
  cart: CompletedBooking[];
  total: number;
  userEmail: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function MockPaymentForm({ cart, total, userEmail, onSuccess, onBack }: MockPaymentFormProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCardNumber = useCallback((value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }, []);

  const formatExpiry = useCallback((value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 2) {
      return digits.slice(0, 2) + "/" + digits.slice(2);
    }
    return digits;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const cardDigits = cardNumber.replace(/\s/g, "");
    if (cardDigits.length < 16) {
      setError("Numéro de carte invalide");
      setIsProcessing(false);
      return;
    }

    if (expiry.length < 5) {
      setError("Date d'expiration invalide");
      setIsProcessing(false);
      return;
    }

    if (cvc.length < 3) {
      setError("CVC invalide");
      setIsProcessing(false);
      return;
    }

    onSuccess();
  };

  const isFormValid = 
    cardNumber.replace(/\s/g, "").length === 16 &&
    expiry.length === 5 &&
    cvc.length >= 3 &&
    cardName.length > 0;

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
          <p className="text-sm text-white/60">Vos données sont protégées</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cardName" className="text-sm font-medium text-white/70">
                Nom sur la carte
              </label>
              <input
                id="cardName"
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="JEAN DUPONT"
                disabled={isProcessing}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 uppercase text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cardNumber" className="text-sm font-medium text-white/70">
                Numéro de carte
              </label>
              <div className="relative">
                <input
                  id="cardNumber"
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  disabled={isProcessing}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <CreditCard className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="expiry" className="text-sm font-medium text-white/70">
                  Date d'expiration
                </label>
                <input
                  id="expiry"
                  type="text"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/AA"
                  disabled={isProcessing}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cvc" className="text-sm font-medium text-white/70">
                  CVC
                </label>
                <input
                  id="cvc"
                  type="text"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  disabled={isProcessing}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isFormValid || isProcessing}
              className={`
                mt-2 flex items-center justify-center gap-2 rounded-lg py-4 text-lg font-semibold transition-all
                ${isFormValid && !isProcessing
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "bg-white/10 text-white/50 cursor-not-allowed"
                }
              `}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Traitement en cours...
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  Payer {formatPrice(total)}
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-white/40">
              <ShieldCheck className="h-4 w-4" />
              <span>Paiement sécurisé par Stripe</span>
            </div>
          </form>
        </div>

        <div className="order-1 lg:order-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h4 className="mb-4 font-semibold">Récapitulatif de commande</h4>
            
            <div className="space-y-3">
              {cart.map((booking) => (
                <div key={booking.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {booking.groupType === "group" ? STUDIOS[booking.studioId].name : "Répétition"}
                    </p>
                    <p className="text-white/50">
                      {formatDate(booking.date, "short")} • {booking.startTime}-{booking.endTime}
                    </p>
                  </div>
                  <span className="font-medium">{formatPrice(booking.price)}</span>
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

          <div className="mt-4 flex items-center justify-center gap-4 text-white/30">
            <img src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg" alt="Visa" className="h-6 opacity-50" />
            <img src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg" alt="Mastercard" className="h-6 opacity-50" />
            <img src="https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg" alt="Amex" className="h-6 opacity-50" />
          </div>
        </div>
      </div>
    </div>
  );
}
