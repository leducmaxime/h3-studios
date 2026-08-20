import { COMPANY, HOSTING, LEGAL_UPDATED_AT, companyFullAddress, companyRcs } from "@/lib/company";

export function MentionsLegales() {
  return (
    <div className="flex min-h-fit grow flex-col items-center pb-16 pt-32">
      <div className="w-full max-w-3xl px-2 lg:px-4">
        <h1 className="mb-8 text-center font-blanka text-4xl lg:text-5xl">
          MENTIONS LEGALES
        </h1>
        <div className="mx-auto mb-12 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="space-y-8 text-white/70">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Éditeur du site</h2>
            <p className="text-sm leading-relaxed">
              Le site <strong className="text-white">{COMPANY.siteHost}</strong> est édité par{" "}
              <strong className="text-white">{COMPANY.legalName}</strong>, {COMPANY.legalForm} ({COMPANY.legalFormLong}) au capital de {COMPANY.shareCapital}, immatriculée au R.C.S. de {COMPANY.rcsCity} sous le numéro {COMPANY.siren}.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">SIRET :</strong> {COMPANY.siret}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">N° TVA intracommunautaire :</strong> {COMPANY.vatNumber}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">RCS :</strong> {companyRcs()}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Siège social :</strong> {companyFullAddress()}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Téléphone :</strong> {COMPANY.phoneDisplay}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Email :</strong> {COMPANY.email}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Directeur de la publication :</strong> {COMPANY.publicationDirector}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Hébergement</h2>
            <p className="text-sm leading-relaxed">
              Le site est hébergé par <strong className="text-white">{HOSTING.name}</strong>
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {HOSTING.address}
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Téléphone :</strong> {HOSTING.phone}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Propriété intellectuelle</h2>
            <p className="text-sm leading-relaxed">
              L'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes, etc.)
              est la propriété exclusive de {COMPANY.legalName} ou de ses partenaires. Toute reproduction,
              représentation, modification, publication, adaptation de tout ou partie des éléments du site,
              quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Limitation de responsabilité</h2>
            <p className="text-sm leading-relaxed">
              {COMPANY.legalName} ne pourra être tenu responsable des dommages directs et indirects causés au
              matériel de l'utilisateur, lors de l'accès au site. {COMPANY.legalName} décline toute responsabilité
              quant à l'utilisation qui pourrait être faite des informations et contenus présents sur
              <strong className="text-white"> {COMPANY.siteHost}</strong>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Cookies</h2>
            <p className="text-sm leading-relaxed">
              Le site utilise des cookies techniques nécessaires au bon fonctionnement du site (session,
              réservation). Aucun cookie de traçage publicitaire n'est utilisé.
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
