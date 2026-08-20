import { COMPANY, LEGAL_UPDATED_AT } from "@/lib/company";

export function PolitiqueConfidentialite() {
  return (
    <div className="flex min-h-fit grow flex-col items-center pb-16 pt-32">
      <div className="w-full max-w-3xl px-2 lg:px-4">
        <h1 className="mb-8 text-center font-blanka text-4xl lg:text-5xl">
          POLITIQUE DE CONFIDENTIALITE
        </h1>
        <div className="mx-auto mb-12 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="space-y-8 text-white/70">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Qui sommes-nous ?</h2>
            <p className="text-sm leading-relaxed">
              Le site <strong className="text-white">{COMPANY.siteHost}</strong> est géré par{" "}
              <strong className="text-white">{COMPANY.legalName}</strong>, {COMPANY.legalForm} ({COMPANY.legalFormLong}),
              responsable du traitement. Nous nous engageons à protéger la vie privée de nos utilisateurs
              et à traiter leurs données personnelles avec le plus grand soin.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Données collectées</h2>
            <p className="text-sm leading-relaxed">
              Nous collectons les données suivantes lors de votre utilisation du site :
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">
              <li><strong className="text-white">Informations de compte :</strong> nom, email, téléphone (lors de la création d'un compte)</li>
              <li><strong className="text-white">Informations de réservation :</strong> date, horaire, studio choisi, équipements</li>
              <li><strong className="text-white">Données de paiement :</strong> gérées exclusivement par Stripe, nous ne stockons pas vos coordonnées bancaires</li>
              <li><strong className="text-white">Données techniques :</strong> adresse IP, type de navigateur (pour la sécurité)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Finalités du traitement</h2>
            <p className="text-sm leading-relaxed">
              Vos données sont utilisées pour :
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">
              <li>Gérer vos réservations et votre compte</li>
              <li>Vous envoyer des confirmations et rappels de réservation</li>
              <li>Assurer la sécurité de nos services</li>
              <li>Améliorer l'expérience utilisateur</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Conservation des données</h2>
            <p className="text-sm leading-relaxed">
              Vos données personnelles sont conservées pendant la durée nécessaire aux finalités
              pour lesquelles elles ont été collectées, et au maximum 3 ans après votre dernière
              activité sur le site. Les données de réservation sont conservées 5 ans pour nos
              obligations comptables.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Vos droits</h2>
            <p className="text-sm leading-relaxed">
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed">
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement (« droit à l'oubli »)</li>
              <li>Droit à la limitation du traitement</li>
              <li>Droit à la portabilité des données</li>
              <li>Droit d'opposition</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed">
              Pour exercer ces droits, contactez-nous à{' '}
              <a href={`mailto:${COMPANY.email}`} className="text-primary hover:underline">
                {COMPANY.email}
              </a>
              .
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              Vous pouvez également introduire une réclamation auprès de la Commission nationale
              de l'informatique et des libertés (CNIL) :{" "}
              <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                www.cnil.fr
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Sécurité</h2>
            <p className="text-sm leading-relaxed">
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
              protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.
              Les communications sont sécurisées via HTTPS et les mots de passe sont hashés avec PBKDF2.
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
