"use client";

import { Mail, Phone, MapPin, Train, Car, Music, GraduationCap, Calendar, Send, User, AtSign, MessageSquare, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json() as { success?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Échec de l'envoi");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi du message");
    } finally {
      setIsSubmitting(false);
    }
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
            setError(null);
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
      <div className="grid gap-4 lg:grid-cols-2">
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
              className="w-full rounded-lg border border-white/20 bg-black py-2.5 pl-10 pr-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="w-full rounded-lg border border-white/20 bg-black py-2.5 pl-10 pr-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
            className="w-full rounded-lg border border-white/20 bg-black py-2.5 pl-10 pr-3 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          className="w-full rounded-lg border border-white/20 bg-black px-3 py-2.5 text-white placeholder:text-white/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

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

const FAQ_ITEMS: { q: string; a: string | string[] }[] = [
  {
    q: "Peut-on annuler ou modifier une réservation ?",
    a: [
      "Oui, vous pouvez modifier ou annuler votre réservation en nous contactant au 06 13 44 08 75 ou par e-mail.",
      "Nous vous demandons de nous prévenir le plus tôt possible afin de libérer le créneau pour d'autres musiciens.",
      "À noter : toute annulation effectuée moins de 24 heures avant le début de la réservation est non remboursable. Si vous avez choisi le paiement sur place, le montant de la réservation reste intégralement dû."
    ]
  },
  {
    q: "Y a-t-il un parking à proximité ?",
    a: "Vous avez la possibilité de vous garer dans la rue en respectant le voisinage."
  },
  {
    q: "Le studio est-il accessible aux personnes à mobilité réduite ?",
    a: "Nos studios sont situés au rez-de-chaussée mais ne respectent pas les normes d'accessibilité pour les personnes à mobilité réduite. Pour toute interrogation, veuillez nous contacter au 0613440875."
  },
  {
    q: "Les mineurs peuvent-ils réserver ?",
    a: "Les mineurs sont les bienvenus, accompagnés d'un adulte responsable."
  },
  {
    q: "Peut-on apporter son propre matériel ?",
    a: "Absolument ! Vous pouvez apporter votre propre matériel en complément de celui fourni. Vous êtes libres d'utiliser vos instruments et effets personnels."
  },
  {
    q: "Proposez-vous des abonnements ou tarifs dégressifs ?",
    a: "Oui, nous proposons des arrangements pour les musiciens réguliers. Contactez-nous au 06 13 44 08 75 pour discuter d'une formule adaptée à votre pratique."
  },
  {
    q: "Quelle est la durée minimale de réservation ?",
    a: "La durée minimale est de 1 heure (2 créneaux de 30 minutes). Les réservations se font par tranches de 30 minutes."
  },
  {
    q: "Le matériel est-il vraiment inclus dans le prix ?",
    a: "Oui, le matériel de base est inclus : batterie, amplis guitare et basse, sono, 4 micros, pupitres et pied synthé. Des options supplémentaires (crash, micros additionnels, etc.) sont disponibles à la réservation."
  },
  {
    q: "Comment réserver en ligne ?",
    a: "Rendez-vous sur la page Réservation, choisissez votre créneau, votre studio et votre formule. La réservation est confirmée après validation du paiement ou de votre choix de règlement sur place."
  },
  {
    q: "Quels modes de paiement sont acceptés ?",
    a: "Nous acceptons le paiement en ligne par carte bancaire (Visa, Mastercard) via notre plateforme sécurisée, ainsi que le règlement sur place en espèces ou par carte."
  },
  {
    q: "Puis-je payer sur place ?",
    a: "Oui, vous pouvez choisir de régler sur place le jour de votre session, en espèces ou par carte bancaire. Le créneau est réservé dès la validation de votre demande."
  },
  {
    q: "Ma réservation est-elle confirmée immédiatement ?",
    a: "Oui, votre réservation est confirmée instantanément. Vous recevrez un email de confirmation avec tous les détails de votre session."
  },
  {
    q: "Que se passe t-il si j'arrive en retard ?",
    a: "Votre créneau est réservé pour la durée que vous avez choisie. En cas de retard, nous accordons une tolérance de 15 minutes. Passé ce délai, la durée de votre session pourra être réduite afin de ne pas impacter les réservations suivantes."
  },
  {
    q: "Comment venir en transports en commun ?",
    a: "Le studio est situé à 2 minutes à pied de la gare de Sucy-Bonneuil (RER A). Vous pouvez également venir en bus : lignes 393, 308 et 104. Adresse : 3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie."
  },
  {
    q: "Que se passe-t-il si je ne me présente pas ?",
    a: "En cas d'absence sans annulation préalable, le créneau vous sera facturé. Pensez à nous prévenir au plus tôt au 06 13 44 08 75 si vous ne pouvez pas venir."
  }
];

export function APropos() {
  const [isVisible, setIsVisible] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex min-h-fit grow flex-col items-center gap-12 pb-16 pt-32">

      <div className="w-full max-w-5xl sm:max-w-[640px] lg:max-w-5xl px-2 lg:px-4">
        <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
          <h1 className="font-blanka text-4xl lg:text-6xl">A PROPOS</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="mt-6 text-lg text-white/60">
            Un son authentique pour des artistes authentiques
          </p>
        </div>
      </div>

      <div className="w-full max-w-5xl sm:max-w-[640px] lg:max-w-5xl px-2 lg:px-4 space-y-6">
        <div className={`overflow-hidden rounded-2xl border border-white/10 bg-black transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "100ms" }}>
          <div className="relative aspect-[21/9] overflow-hidden">
            <video
              src="/videos/hero-about.mp4"
              autoPlay
              loop
              muted
              playsInline
              title="H3 Studios - Découvrez nos studios de répétition"
              aria-label="Vidéo de présentation des studios H3 Studios"
              className="h-full w-full object-cover grayscale contrast-[1.4] brightness-[0.9]"
            >
              Votre navigateur ne supporte pas la lecture de vidéos. Découvrez H3 Studios, vos studios de répétition à Sucy-en-Brie.
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          
          <div className="p-6 lg:p-8">
            <p className="text-lg text-white/80 leading-relaxed">
              <span className="font-bold text-primary">H3 Studios</span>
              {", situé à 2 minutes à pied de la gare de Sucy-Bonneuil, est un lieu originellement dédié aux répétitions et enregistrements de groupes de musique amplifiée, mais permet aussi, de par son architecture et ses équipements, d'accueillir d'autres activités, culturelles ou non."}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className={`rounded-2xl border border-white/10 bg-black p-6 text-center transition-all duration-700 hover:border-primary/50 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "200ms" }}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Groupes</h3>
            <p className="mt-2 text-sm text-white/70">
              Musique amplifiée ou acoustique, professionnel ou amateur, pour répéter, enregistrer ou se produire.
            </p>
          </div>

          <div className={`rounded-2xl border border-white/10 bg-black p-6 text-center transition-all duration-700 hover:border-primary/50 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "300ms" }}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Enseignants</h3>
            <p className="mt-2 text-sm text-white/70">
              Musiciens, formateurs cherchant un lieu pour donner des cours, animer des ateliers ou dispenser des formations.
            </p>
          </div>

          <div className={`rounded-2xl border border-white/10 bg-black p-6 text-center transition-all duration-700 hover:border-primary/50 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "400ms" }}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary">Évènements</h3>
            <p className="mt-2 text-sm text-white/70">
              Organisation d'évènements particuliers dans un lieu spacieux et insonorisé.
            </p>
          </div>
        </div>

        <div
          id="contact"
          className={`rounded-2xl border border-white/10 bg-black p-6 lg:p-8 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
          style={{ transitionDelay: "500ms" }}
        >
          <h2 className="mb-6 text-xl font-bold text-primary">Contact</h2>
          <div className="mb-6 grid gap-4 lg:grid-cols-2 relative z-10">
            <a
              href="mailto:contact@h3-studios.fr"
              className="group flex items-center justify-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-6 py-4 transition-all hover:bg-primary/20 hover:scale-[1.02] active:scale-95 cursor-pointer relative z-20"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-black">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-primary uppercase tracking-wider">Email</span>
                <span className="text-lg font-bold text-white group-hover:text-primary transition-colors">contact@h3-studios.fr</span>
              </div>
            </a>
            <a
              href="tel:+33613440875"
              className="group flex items-center justify-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-6 py-4 transition-all hover:bg-primary/20 hover:scale-[1.02] active:scale-95 cursor-pointer relative z-20"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-black">
                <Phone className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-primary uppercase tracking-wider">Téléphone</span>
                <span className="text-lg font-bold text-white group-hover:text-primary transition-colors">06 13 44 08 75</span>
              </div>
            </a>
          </div>
          
          <div className="border-t border-white/10 pt-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/50">Ou envoyez-nous un message</h3>
            <ContactForm />
          </div>
        </div>

        <div className={`rounded-2xl border border-white/10 bg-black p-6 lg:p-8 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "600ms" }}>
          <h2 className="mb-6 text-xl font-bold text-primary">Localisation</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <a
                href="https://www.google.com/maps/place/H3+Studios/@48.7705935,2.5030795,17z/data=!3m1!4b1!4m6!3m5!1s0x47e60b37cb1ad28b:0x40d26627b3082428!8m2!3d48.7705935!4d2.5056598!16s%2Fg%2F11w8gqst45"
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
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2638.6015!2d2.5030795!3d48.7705935!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e60b37cb1ad28b%3A0x40d26627b3082428!2sH3%20Studios!5e0!3m2!1sfr!2sfr!4v1739634000000"
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

      {/* FAQ */}
      <section className="w-full py-16 lg:py-20">
        <div className="mx-auto w-full max-w-4xl sm:max-w-[640px] lg:max-w-4xl px-4">
          <h2 className="mb-2 text-center font-blanka text-3xl lg:text-4xl">FAQ</h2>
          <p className="mb-10 text-center text-white/60">Questions fréquentes</p>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="w-full rounded-xl border border-white/10 bg-black overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="flex-1 min-w-0 pr-4 font-medium text-white/90">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-primary transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="space-y-3 border-t border-white/10 px-5 py-4">
                    {(Array.isArray(item.a) ? item.a : [item.a]).map((paragraph, pi) => (
                      <p key={pi} className="text-sm leading-relaxed text-primary">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
