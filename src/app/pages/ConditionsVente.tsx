export function ConditionsVente() {
  return (
    <div className="flex min-h-fit grow flex-col items-center pb-16 pt-32">
      <div className="w-full max-w-3xl px-2 sm:px-4">
        <h1 className="mb-8 text-center font-blanka text-4xl md:text-5xl">
          CONDITIONS DE VENTE
        </h1>
        <div className="mx-auto mb-12 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="space-y-8 text-white/70">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Objet</h2>
            <p className="text-sm leading-relaxed">
              Les présentes conditions de vente régissent l'ensemble des réservations de studios de
              répétition et d'enregistrement effectuées sur le site <strong className="text-white">h3-studios.fr</strong>,
              exploité par Marcel Hamon, auto-entrepreneur.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Réservation</h2>
            <p className="text-sm leading-relaxed">
              La réservation d'un studio se fait en ligne via notre système de booking. Le client
              sélectionne la date, le créneau horaire, le studio souhaité et les équipements optionnels.
              La réservation n'est définitive qu'après confirmation du paiement (en ligne ou sur place).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Tarifs et paiement</h2>
            <p className="text-sm leading-relaxed">
              Les tarifs sont indiqués en euros TTC sur la page <strong className="text-white">/tarifs</strong>.
              Ils peuvent être modifiés à tout moment sans préavis. Le paiement s'effectue :
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">
              <li><strong className="text-white">En ligne</strong> : par carte bancaire via Stripe (sécurisé)</li>
              <li><strong className="text-white">Sur place</strong> : en espèces ou par carte bancaire</li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed">
              Un acompte peut être demandé pour certaines réservations. La facture est disponible
              sur demande.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Annulation et remboursement</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-white">Annulation par le client :</strong>
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">
              <li>Plus de 48h avant la séance : remboursement intégral</li>
              <li>Entre 24h et 48h avant : remboursement de 50%</li>
              <li>Moins de 24h avant : aucun remboursement</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed">
              <strong className="text-white">Annulation par H3 Studios :</strong> en cas d'annulation de notre part
              (maintenance, force majeure), le client sera intégralement remboursé ou pourra reporter sa séance.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Utilisation des studios</h2>
            <p className="text-sm leading-relaxed">
              Le client s'engage à :
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">
              <li>Respecter les horaires de réservation (arrivée et départ à l'heure)</li>
              <li>Ne pas dépasser la capacité maximale du studio</li>
              <li>Utiliser le matériel avec soin et le signaler en cas de problème</li>
              <li>Ne pas fumer dans les studios</li>
              <li>Respecter le voisinage (niveau sonore raisonnable)</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed">
              Tout dommage causé au matériel ou aux locaux par le client ou ses invités engage sa responsabilité.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Responsabilité</h2>
            <p className="text-sm leading-relaxed">
              H3 Studios décline toute responsabilité en cas de vol, perte ou détérioration des
              effets personnels du client. Le client est invité à surveiller ses biens. Les objets
              oubliés seront conservés 30 jours maximum.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Litiges</h2>
            <p className="text-sm leading-relaxed">
              En cas de litige, une solution amiable sera recherchée en priorité. À défaut, le litige
              sera soumis aux tribunaux compétents du ressort du siège social.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
