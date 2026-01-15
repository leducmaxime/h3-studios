"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Calendar, Download, Mail, Home, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/booking";

interface PaymentSuccessProps {
  paymentId?: string;
}

export function PaymentSuccess({ paymentId }: PaymentSuccessProps) {
  const [bookingData, setBookingData] = useState<{
    refs: string[];
    email: string;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedData = localStorage.getItem("h3-pending-payment");
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setBookingData(data);
        localStorage.removeItem("h3-pending-payment");
        
        localStorage.removeItem("h3-booking-state");
      } catch {
        console.error("Failed to parse booking data");
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-8 pb-8 pt-24">
      <div className="w-full max-w-[600px] px-4">
        <div className="relative overflow-hidden rounded-2xl border-4 border-green-500 bg-black/80 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />

          <div className="relative p-6 sm:p-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
            </div>

            <h1 className="mb-2 font-blanka text-2xl sm:text-3xl text-green-400">
              PAIEMENT CONFIRMÉ
            </h1>
            
            <p className="mb-6 text-white/70">
              Merci ! Votre réservation est confirmée.
            </p>

            {bookingData && (
              <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-left">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-white/60">Référence(s)</span>
                  <span className="font-mono font-medium text-primary">
                    {bookingData.refs.join(", ")}
                  </span>
                </div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-white/60">Total payé</span>
                  <span className="text-xl font-bold text-green-400">
                    {formatPrice(bookingData.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Confirmation envoyée à</span>
                  <span className="text-sm text-white/80">{bookingData.email}</span>
                </div>
              </div>
            )}

            <div className="mb-6 rounded-lg bg-primary/10 border border-primary/30 p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-left text-white/80">
                  Un email de confirmation avec tous les détails de votre réservation 
                  vous a été envoyé. Pensez à vérifier vos spams.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href="/"
                className="flex items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-black transition-colors hover:bg-primary/90"
              >
                <Home className="h-5 w-5" />
                Retour à l'accueil
              </a>
              
              <a
                href="/reservation"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/20 py-3 font-medium text-white transition-colors hover:bg-white/10"
              >
                <Calendar className="h-5 w-5" />
                Nouvelle réservation
              </a>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-white/40">
        Des questions ? Contactez-nous à contact@h3-studios.fr
      </p>
    </div>
  );
}
