import styles from "@/styles/globals.css?url";
import { SITE_URL, SITE_NAME, pageSEO, generateJsonLd, type PageSEO } from "./seo";

interface DocumentProps {
  children: React.ReactNode;
  path?: string;
  nonce?: string;
}

export const Document: React.FC<DocumentProps> = ({ children, path = "/", nonce }) => {
  const seo: PageSEO = pageSEO[path] || pageSEO["/"];
  const canonicalUrl = `${SITE_URL}${seo.path}`;
  const ogImageUrl = `${SITE_URL}/images/opengraph.png`;
  const jsonLd = generateJsonLd();

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
        <meta name="robots" content="index, follow" />
        <meta name="language" content="French" />
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
        
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

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
        
        <div
          id="root"
          className="flex min-h-screen w-screen flex-col overflow-x-hidden text-white"
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
