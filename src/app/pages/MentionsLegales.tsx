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
              Le site <strong className="text-white">h3-studios.fr</strong> est édité par Marcel Hamon,
              auto-entrepreneur immatriculé sous le numéro SIRET 499 465 721 00026.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Siège social :</strong> 3 Rue de la Grande Ceinture, 94370 Sucy-en-Brie
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Téléphone :</strong> 06 13 44 08 75
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              <strong className="text-white">Email :</strong> contact@h3-studios.fr
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Hébergement</h2>
            <p className="text-sm leading-relaxed">
              Le site est hébergé par <strong className="text-white">Cloudflare, Inc.</strong>
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              101 Townsend Street, San Francisco, CA 94107, États-Unis
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Propriété intellectuelle</h2>
            <p className="text-sm leading-relaxed">
              L'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes, etc.)
              est la propriété exclusive de Marcel Hamon ou de ses partenaires. Toute reproduction,
              représentation, modification, publication, adaptation de tout ou partie des éléments du site,
              quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Limitation de responsabilité</h2>
            <p className="text-sm leading-relaxed">
              Marcel Hamon ne pourra être tenu responsable des dommages directs et indirects causés au
              matériel de l'utilisateur, lors de l'accès au site. Marcel Hamon décline toute responsabilité
              quant à l'utilisation qui pourrait être faite des informations et contenus présents sur
              <strong className="text-white"> h3-studios.fr</strong>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-primary">Cookies</h2>
            <p className="text-sm leading-relaxed">
              Le site utilise des cookies techniques nécessaires au bon fonctionnement du site (session,
              réservation). Aucun cookie de traçage publicitaire n'est utilisé.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
