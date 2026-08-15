import styles from "@/styles/globals.css?url";
import { SITE_URL, SITE_NAME, pageSEO, generateJsonLd, type PageSEO } from "./seo";

const BREADCRUMB_NAMES: Record<string, string> = {
  "les-studios": "Les Studios",
  "le-materiel": "Le Matériel",
  "tarifs": "Tarifs",
  "reservation": "Réservation",
  "a-propos": "À Propos",
  "avis": "Avis",
  "equipe": "L'Équipe",
  "actualites": "Actualités",
  "mentions-legales": "Mentions Légales",
  "politique-confidentialite": "Politique de Confidentialité",
  "conditions-de-vente": "CGV",
  "mon-compte": "Mon Compte",
  "connexion": "Connexion",
  "profil": "Profil",
};

const LEGAL_PATHS = ["/mentions-legales", "/politique-confidentialite", "/conditions-de-vente"];

interface DocumentProps {
  children: React.ReactNode;
  path?: string;
  nonce?: string;
}

function buildBreadcrumb(currentPath: string) {
  const segments = currentPath.split("/").filter(Boolean);
  const itemListElement: Array<{ "@type": string; position: number; name: string; item: string }> = [
    { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
  ];

  let accumulated = "";
  for (let i = 0; i < segments.length; i++) {
    accumulated += `/${segments[i]}`;
    const name = BREADCRUMB_NAMES[segments[i]] || segments[i];
    itemListElement.push({
      "@type": "ListItem",
      position: i + 2,
      name,
      item: `${SITE_URL}${accumulated}`,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

export const Document: React.FC<DocumentProps> = ({ children, path = "/", nonce }) => {
  const seo: PageSEO = pageSEO[path] || pageSEO["/"];
  const canonicalUrl = `${SITE_URL}${seo.path}`;
  const ogImageUrl = `${SITE_URL}/images/opengraph.png`;

  const isAdmin = path.startsWith("/admin");
  const isLegal = LEGAL_PATHS.includes(path);
  const isAbout = path === "/a-propos";
  const isHome = path === "/";

  // Build JSON-LD scripts array
  const jsonLdScripts: object[] = [];

  if (!isAdmin) {
    if (isLegal) {
      // Simple WebPage for legal pages
      jsonLdScripts.push({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: seo.title,
        description: seo.description,
      });
    } else {
      // Main MusicVenue JSON-LD (existing)
      jsonLdScripts.push(generateJsonLd());

      // Add FAQPage on /a-propos
      if (isAbout) {
        jsonLdScripts.push({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Comment réserver un studio ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "La réservation se fait en ligne via notre site. Choisissez votre date, créneau horaire et studio, puis finalisez votre réservation en quelques clics.",
              },
            },
            {
              "@type": "Question",
              name: "Quels sont les moyens de paiement acceptés ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Nous acceptons le paiement par carte bancaire (via Stripe) et le paiement en espèces sur place.",
              },
            },
            {
              "@type": "Question",
              name: "Puis-je annuler ou modifier ma réservation ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Oui, vous pouvez modifier ou annuler votre réservation en nous contactant au 06 13 44 08 75 ou par e-mail. Nous vous demandons de nous prévenir le plus tôt possible afin de libérer le créneau pour d'autres musiciens. À noter : toute annulation effectuée moins de 24 heures avant le début de la réservation est non remboursable. Si vous avez choisi le paiement sur place, le montant de la réservation reste intégralement dû.",
              },
            },
            {
              "@type": "Question",
              name: "Le matériel est-il fourni ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Oui, chaque studio est équipé d'une sono, d'une batterie et d'amplis. Du matériel supplémentaire est disponible en location.",
              },
            },
            {
              "@type": "Question",
              name: "Y a-t-il un parking à proximité ?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Oui, un parking gratuit est disponible devant les studios. L'accès est également possible en transports en commun (RER A, bus).",
              },
            },
          ],
        });
      }
    }

    // BreadcrumbList on all pages except home
    if (!isHome) {
      jsonLdScripts.push(buildBreadcrumb(path));
    }
  }

  return (
    <html lang="fr" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        <title>{seo.title}</title>
        <meta name="title" content={seo.title} />
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords.join(", ")} />
        <meta name="author" content={SITE_NAME} />
        <meta name="robots" content={isAdmin ? "noindex, nofollow" : "index, follow"} />
        <meta name="revisit-after" content="7 days" />
        
        <link rel="canonical" href={canonicalUrl} />
        
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`${SITE_NAME} - Studios de répétition et enregistrement`} />
        <meta property="og:locale" content="fr_FR" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={canonicalUrl} />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta name="twitter:image:alt" content={`${SITE_NAME} - Studios de répétition et enregistrement`} />
        
        <meta name="geo.region" content="FR-94" />
        <meta name="geo.placename" content="Sucy-en-Brie" />
        <meta name="geo.position" content="48.7697;2.5178" />
        <meta name="ICBM" content="48.7697, 2.5178" />
        
        {jsonLdScripts.map((json, i) => (
          <script
            key={i}
            type="application/ld+json"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
          />
        ))}

        <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-variable-latin.woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href={styles} />
        <link rel="preload" href="/images/background.webp" as="image" />
        {path === "/" && (
          <link
            rel="preload"
            as="image"
            type="image/webp"
            href="/images/home/hero.webp"
            imageSrcSet="/images/home/hero-768.webp 768w, /images/home/hero.webp 1306w"
            imageSizes="(max-width: 768px) 100vw, 672px"
            fetchPriority="high"
          />
        )}
        
        <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/icon-512.png" sizes="512x512" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180" />
        <link rel="manifest" href="/manifest.webmanifest?v=2" />
        <meta name="theme-color" content="#ffde59" />

        <link rel="modulepreload" href="/src/client.tsx" />
      </head>
      <body className="flex min-h-screen flex-col bg-[url('/images/background.webp')] bg-[length:500px] bg-repeat font-secondary">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=G-B3TYEET971"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        
        {/* `overflow-x-clip` et non `hidden` : `overflow-x: hidden` force
            `overflow-y: auto`, ce qui fait de ce conteneur le scrollport de
            toute l'application. Les éléments `sticky` situés à l'intérieur
            s'ancrent alors sur un scrollport qui ne défile jamais et ne collent
            jamais (barre d'admin, contrôles du calendrier). `clip` bloque le
            débordement horizontal à l'identique sans créer de scrollport. */}
        <div
          id="root"
          className="flex min-h-screen w-screen flex-col overflow-x-clip text-white"
        >
          {children}
        </div>
        <script type="module" src="/src/client.tsx" nonce={nonce} />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','G-B3TYEET971');`,
          }}
        />
      </body>
    </html>
  );
};
