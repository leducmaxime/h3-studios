import { COMPANY, LEGAL_UPDATED_AT, companyFullAddress } from "@/lib/company";

export function ConditionsVente() {
  return (
    <div className="flex min-h-fit grow flex-col items-center pb-16 pt-32">
      <div className="w-full max-w-3xl px-2 lg:px-4">
        <h1 className="mb-8 text-center font-blanka text-4xl lg:text-5xl">
          CONDITIONS DE VENTE
        </h1>
        <div className="mx-auto mb-12 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="space-y-8 text-white/70">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Vendeur</h2>
            <p className="text-sm leading-relaxed">
              Les présentes conditions générales de vente (CGV) s'appliquent aux
              réservations effectuées sur le site{" "}
              <strong className="text-white">{COMPANY.siteHost}</strong>, exploité par{" "}
              <strong className="text-white">{COMPANY.legalName}</strong>, {COMPANY.legalForm} ({COMPANY.legalFormLong}) au capital de {COMPANY.shareCapital}, immatriculée au R.C.S. de {COMPANY.rcsCity} sous le numéro {COMPANY.siren}.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">SIRET :</strong> {COMPANY.siret}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">N° TVA intracommunautaire :</strong> {COMPANY.vatNumber}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Siège social :</strong> {companyFullAddress()}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Téléphone :</strong> {COMPANY.phoneDisplay}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Email :</strong>{" "}
              <a href={`mailto:${COMPANY.email}`} className="text-primary hover:underline">
                {COMPANY.email}
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Objet</h2>
            <p className="text-sm leading-relaxed">
              Les présentes conditions régissent la réservation de studios de
              répétition et d'enregistrement, ainsi que la location d'équipements
              optionnels proposés sur le site.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Réservation</h2>
            <p className="text-sm leading-relaxed">
              La réservation se fait en ligne. Le client choisit le type de
              séance, la date, le créneau, le studio et, le cas échéant, les
              équipements optionnels. Un code promo peut être appliqué avant le
              paiement.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              La réservation n'est définitive qu'après confirmation : paiement en
              ligne, ou validation d'une réservation à régler sur place. En
              validant sa commande, le client accepte les présentes CGV.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Tarifs et paiement</h2>
            <p className="text-sm leading-relaxed">
              Les tarifs sont indiqués en euros TTC (TVA 20 %) sur la page{" "}
              <a href="/tarifs" className="text-primary hover:underline">
                Tarifs
              </a>
              . Ils peuvent être modifiés à tout moment ; le prix applicable est
              celui affiché au moment de la confirmation de la réservation. Les
              tarifs varient selon le studio, le type de séance et le créneau
              (heures creuses / heures de pointe).
            </p>
            <p className="mt-2 text-sm leading-relaxed">Le paiement s'effectue :</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">
              <li><strong className="text-white">En ligne</strong> : par carte bancaire via Stripe</li>
              <li><strong className="text-white">Sur place</strong> : en espèces ou par carte bancaire</li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed">
              La facture est disponible sur demande.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Annulation et remboursement</h2>
            <p className="text-sm leading-relaxed">
              <strong className="text-white">Annulation par le client :</strong>
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">
              <li>24h ou plus avant la séance : remboursement intégral</li>
              <li>Moins de 24h avant la séance : aucun remboursement</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed">
              Si vous avez choisi le paiement sur place, le montant de la
              réservation reste intégralement dû pour toute annulation effectuée
              moins de 24 heures avant le début de la réservation.
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              <strong className="text-white">Annulation par H3 Studios :</strong> en
              cas d'annulation de notre part (maintenance, force majeure), le
              client sera intégralement remboursé ou pourra reporter sa séance.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Droit de rétractation</h2>
            <p className="text-sm leading-relaxed">
              Conformément à l'article L.221-28 du Code de la consommation, le
              droit de rétractation ne s'applique pas aux prestations de services
              de loisirs devant être fournis à une date ou à une période
              déterminée. La réservation d'un créneau de studio constitue une
              telle prestation. En validant sa réservation, le client reconnaît
              et accepte cette exclusion.
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
              Tout dommage causé au matériel ou aux locaux par le client ou ses
              invités engage sa responsabilité.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Responsabilité</h2>
            <p className="text-sm leading-relaxed">
              H3 Studios décline toute responsabilité en cas de vol, perte ou
              détérioration des effets personnels du client. Le client est invité
              à surveiller ses biens. Les objets oubliés seront conservés 30 jours
              maximum.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Données personnelles</h2>
            <p className="text-sm leading-relaxed">
              Les données collectées pour la réservation sont traitées conformément
              à la{" "}
              <a href="/politique-confidentialite" className="text-primary hover:underline">
                politique de confidentialité
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Litiges</h2>
            <p className="text-sm leading-relaxed">
              En cas de litige, une solution amiable sera recherchée en priorité.
              À défaut, le litige sera soumis aux tribunaux compétents du ressort
              du siège social.
            </p>
          </section>

          <p className="text-xs text-white/40">
            Dernière mise à jour : {LEGAL_UPDATED_AT}
          </p>
        </div>
      </div>
    </div>
  );
}
