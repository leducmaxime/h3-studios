"use client";

import { ScrollUp } from "@/components/common/ScrollUp";
import { Mail, Phone, MapPin, Train, Car, Music, GraduationCap, Calendar, Send, User, AtSign, MessageSquare } from "lucide-react";
import { useState } from "react";

function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    setSubmitted(true);
    setIsSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-primary">Message envoyé !</h3>
        <p className="text-white/70">Nous vous répondrons dans les plus brefs délais.</p>
        <button
          onClick={() => {
            setSubmitted(false);
            setFormData({ name: "", email: "", subject: "", message: "" });
          }}
          className="mt-2 text-sm text-white/50 hover:text-primary"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-name" className="text-sm font-medium text-white/70">
            Nom <span className="text-primary">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              id="contact-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Votre nom"
              required
              className="w-full rounded-lg border border-white/20 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className="text-sm font-medium text-white/70">
            Email <span className="text-primary">*</span>
          </label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              id="contact-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="votre@email.fr"
              required
              className="w-full rounded-lg border border-white/20 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-subject" className="text-sm font-medium text-white/70">
          Objet <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            id="contact-subject"
            type="text"
            value={formData.subject}
            onChange={(e) => handleChange("subject", e.target.value)}
            placeholder="Objet de votre message"
            required
            className="w-full rounded-lg border border-white/20 bg-white/5 py-2.5 pl-10 pr-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium text-white/70">
          Message <span className="text-primary">*</span>
        </label>
        <textarea
          id="contact-message"
          value={formData.message}
          onChange={(e) => handleChange("message", e.target.value)}
          placeholder="Votre message..."
          rows={4}
          required
          className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-base font-semibold text-black transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            Envoi en cours...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Envoyer
          </>
        )}
      </button>
    </form>
  );
}

export function APropos() {
  return (
    <div className="flex min-h-fit grow flex-col items-center gap-12 pb-16 pt-32">
      <ScrollUp />

      <div className="w-full max-w-5xl px-4">
        <div className="mb-8 text-center">
          <h1 className="font-blanka text-4xl md:text-5xl lg:text-6xl">À PROPOS</h1>
          <p className="mt-4 text-lg text-white/60">
            Un son authentique pour des artistes authentiques
          </p>
        </div>
      </div>

      <div className="w-full max-w-5xl px-4 space-y-6">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="relative aspect-[21/9]">
            <img
              src="/images/about/bandeau.jpg"
              alt="H3 Studios"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          
          <div className="p-6 lg:p-8">
            <p className="text-lg text-white/80 leading-relaxed">
              <span className="font-bold text-primary">H3 Studios</span>
              {", situé à 2 minutes à pied de la gare de Sucy-Bonneuil, est un lieu originellement dédié aux répétitions et enregistrements de groupes de musique amplifiée, mais permet aussi, de par son architecture et ses équipements, d'accueillir d'autres activités, culturelles ou non."}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:border-primary/50">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Groupes</h3>
            <p className="mt-2 text-sm text-white/70">
              Musique amplifiée ou acoustique, professionnel ou amateur, pour répéter, enregistrer ou se produire.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:border-primary/50">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Enseignants</h3>
            <p className="mt-2 text-sm text-white/70">
              Musiciens, formateurs cherchant un lieu pour donner des cours, animer des ateliers ou dispenser des formations.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:border-primary/50">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Évènements</h3>
            <p className="mt-2 text-sm text-white/70">
              Organisation d'évènements particuliers dans un lieu spacieux et insonorisé.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 lg:p-8">
          <h2 className="mb-6 text-xl font-bold text-primary">Contact</h2>
          <div className="mb-6 grid gap-6 sm:grid-cols-2">
            <a
              href="mailto:contact@h3-studios.fr"
              className="flex items-center gap-3 text-white/70 transition-colors hover:text-primary"
            >
              <Mail className="h-5 w-5 text-primary" />
              <span>contact@h3-studios.fr</span>
            </a>
            <a
              href="tel:+33613440875"
              className="flex items-center gap-3 text-white/70 transition-colors hover:text-primary"
            >
              <Phone className="h-5 w-5 text-primary" />
              <span>06 13 44 08 75</span>
            </a>
          </div>
          
          <div className="border-t border-white/10 pt-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/50">Ou envoyez-nous un message</h3>
            <ContactForm />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 lg:p-8">
          <h2 className="mb-6 text-xl font-bold text-primary">Localisation</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <a
                href="https://maps.app.goo.gl/STjxqLmfUnL6mEMY9"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 text-white/70 transition-colors hover:text-primary"
              >
                <MapPin className="h-5 w-5 flex-shrink-0 text-primary" />
                <span>3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie</span>
              </a>
              <div className="flex items-start gap-3 text-white/70">
                <Train className="h-5 w-5 flex-shrink-0 text-primary" />
                <span>Gare de Sucy-Bonneuil à 2 min • RER A • BUS 393, 308, 104</span>
              </div>
              <div className="flex items-start gap-3 text-white/70">
                <Car className="h-5 w-5 flex-shrink-0 text-primary" />
                <span>Stationnement gratuit dans la rue</span>
              </div>
            </div>
            
            <div className="overflow-hidden rounded-xl">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2638.5466!2d2.5197!3d48.7714!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e5e1a1b1b1b1b1%3A0x1234567890abcdef!2s3%20Rue%20de%20la%20Grande%20Ceinture%2C%2094370%20Sucy-en-Brie!5e0!3m2!1sfr!2sfr!4v1700000000000"
                width="100%"
                height="200"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="H3 Studios - Localisation"
                className="rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
