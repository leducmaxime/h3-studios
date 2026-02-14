export const SITE_URL = "https://h3-studios.amis-harmonie-sucy.workers.dev";
export const SITE_NAME = "H3 STUDIOS";

export interface PageSEO {
  title: string;
  description: string;
  keywords: string[];
  path: string;
}

export const pageSEO: Record<string, PageSEO> = {
  "/": {
    title: "H3 STUDIOS - Studios de Répétition et Enregistrement à Sucy-en-Brie",
    description:
      "H3 Studios propose la location de studios de répétition et d'enregistrement à Sucy-en-Brie (94). Deux espaces équipés : La Scène (42m²) et Le Podium (35m²). À 2 min de la gare RER A Sucy-Bonneuil.",
    keywords: [
      "studio répétition",
      "studio enregistrement",
      "Sucy-en-Brie",
      "location studio musique",
      "répétition groupe",
      "Val-de-Marne",
      "94",
      "RER A",
    ],
    path: "/",
  },
  "/les-studios": {
    title: "Nos Studios de Répétition - La Scène & Le Podium | H3 STUDIOS",
    description:
      "Découvrez nos deux studios de répétition à Sucy-en-Brie : La Scène (42m², hauteur 3,50m, scène avec éclairage) et Le Podium (35m², idéal répétitions et cours). Équipement professionnel inclus.",
    keywords: [
      "studio La Scène",
      "studio Le Podium",
      "salle répétition équipée",
      "studio musique 94",
      "location salle répétition",
      "studio groupe musique",
    ],
    path: "/les-studios",
  },
  "/le-materiel": {
    title: "Matériel et Équipement des Studios | H3 STUDIOS Sucy-en-Brie",
    description:
      "Équipement professionnel inclus : batteries Yamaha et Pearl, amplis Marshall/Fender/Ampeg, sono complète, matériel d'enregistrement Focusrite. Location d'instruments disponible.",
    keywords: [
      "équipement studio",
      "batterie Yamaha",
      "ampli Marshall",
      "matériel enregistrement",
      "location instruments",
      "sono répétition",
      "Focusrite",
    ],
    path: "/le-materiel",
  },
  "/tarifs": {
    title: "Tarifs - Studios dès 6€/h | H3 STUDIOS Sucy-en-Brie",
    description:
      "Tarifs H3 Studios : Solo/Prof particulier 6€/h, Duo 12€/h, Groupe dès 15€/h. Enregistrement 50€/h. Studios de répétition à Sucy-en-Brie, à 2 min du RER A.",
    keywords: [
      "tarif studio répétition",
      "prix location studio",
      "enregistrement tarif",
      "studio pas cher",
      "tarif groupe musique",
      "prix répétition",
    ],
    path: "/tarifs",
  },
  "/reservation": {
    title: "Réservation en Ligne - Studio de Répétition | H3 STUDIOS",
    description:
      "Réservez votre créneau en ligne chez H3 Studios. Choisissez votre date, horaire et studio. Confirmation immédiate. Studios à Sucy-en-Brie.",
    keywords: [
      "réservation studio",
      "réserver salle répétition",
      "booking studio musique",
      "réservation en ligne",
      "créneau répétition",
    ],
    path: "/reservation",
  },
  "/a-propos": {
    title: "À Propos - H3 STUDIOS | Studio de Musique à Sucy-en-Brie",
    description:
      "H3 Studios, situé à 2 min de la gare RER A Sucy-Bonneuil. Studios de répétition et enregistrement pour groupes, musiciens solo, enseignants. Contact : 06 13 44 08 75.",
    keywords: [
      "H3 Studios",
      "studio musique Sucy",
      "gare Sucy-Bonneuil",
      "contact studio",
      "adresse studio répétition",
      "RER A studio",
    ],
    path: "/a-propos",
  },
  "/avis": {
    title: "Avis Clients - Témoignages | H3 STUDIOS Sucy-en-Brie",
    description:
      "Découvrez les avis de nos clients sur H3 Studios. Studio de répétition et enregistrement à Sucy-en-Brie. Note moyenne : 4.9/5 sur Google.",
    keywords: [
      "avis H3 Studios",
      "témoignages clients",
      "avis studio répétition",
      "Google reviews",
      "opinions clients",
    ],
    path: "/avis",
  },
  "/equipe": {
    title: "L'Équipe - Les Passionnés de H3 STUDIOS | Sucy-en-Brie",
    description:
      "Découvrez l'équipe de H3 Studios : Marcel, gérant et musicien passionné avec 30 ans d'expérience. Professeur de percussions, MAO, et arrangeur.",
    keywords: [
      "équipe H3 Studios",
      "Marcel H3 Studios",
      "gérant studio répétition",
      "musiciens Sucy-en-Brie",
      "professeur percussion",
    ],
    path: "/equipe",
  },
  "/actualites": {
    title: "Actualités - Suivez nos Nouvelles | H3 STUDIOS Sucy-en-Brie",
    description:
      "Suivez les actualités de H3 Studios sur Instagram @h3_studios_sucy. Découvrez nos dernières nouvelles, événements et coulisses du studio.",
    keywords: [
      "actualités H3 Studios",
      "nouvelles studio",
      "Instagram H3 Studios",
      "événements musique",
      "coulisses studio",
    ],
    path: "/actualites",
  },
};

export const routes = Object.keys(pageSEO);

export const businessInfo = {
  name: "H3 STUDIOS",
  description:
    "Studios de répétition et d'enregistrement pour groupes de musique à Sucy-en-Brie",
  url: SITE_URL,
  telephone: "+33613440875",
  email: "contact@h3-studios.fr",
  address: {
    streetAddress: "3 Rue de la Grande Ceinture",
    addressLocality: "Sucy-en-Brie",
    postalCode: "94370",
    addressCountry: "FR",
  },
  geo: {
    latitude: 48.7697,
    longitude: 2.5178,
  },
  openingHours: ["Mo 18:00-00:00", "Tu-Su 10:00-00:00"],
  priceRange: "€€",
  image: `${SITE_URL}/images/opengraph.png`,
};

export function generateJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "MusicVenue",
    name: businessInfo.name,
    description: businessInfo.description,
    url: businessInfo.url,
    telephone: businessInfo.telephone,
    email: businessInfo.email,
    address: {
      "@type": "PostalAddress",
      ...businessInfo.address,
    },
    geo: {
      "@type": "GeoCoordinates",
      ...businessInfo.geo,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "10:00",
      closes: "00:00",
    },
    priceRange: businessInfo.priceRange,
    image: businessInfo.image,
    sameAs: [],
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Sound Equipment" },
      { "@type": "LocationFeatureSpecification", name: "Recording Equipment" },
      { "@type": "LocationFeatureSpecification", name: "Drum Kit" },
      { "@type": "LocationFeatureSpecification", name: "Guitar Amplifiers" },
      { "@type": "LocationFeatureSpecification", name: "Bass Amplifiers" },
      { "@type": "LocationFeatureSpecification", name: "PA System" },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Studio Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Studio La Scène - Répétition Groupe",
            description: "Studio de 42m² avec scène et éclairage",
          },
          priceSpecification: {
            "@type": "PriceSpecification",
            price: "18",
            priceCurrency: "EUR",
            unitText: "HOUR",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Studio Le Podium - Répétition Groupe",
            description: "Studio de 35m² pour répétitions",
          },
          priceSpecification: {
            "@type": "PriceSpecification",
            price: "15",
            priceCurrency: "EUR",
            unitText: "HOUR",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Enregistrement",
            description: "Prise de son professionnelle",
          },
          priceSpecification: {
            "@type": "PriceSpecification",
            price: "50",
            priceCurrency: "EUR",
            unitText: "HOUR",
          },
        },
      ],
    },
  };
}

export function generateSitemap(): string {
  const lastmod = new Date().toISOString().split("T")[0];
  
  const urls = routes.map((path) => {
    const priority = path === "/" ? "1.0" : "0.8";
    const changefreq = path === "/" ? "weekly" : "monthly";
    return `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml

# Disallow admin/private paths (none currently)
`;
}
