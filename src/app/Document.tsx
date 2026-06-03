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

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap&family=Inter:wght@300;400;500;600;700&display=optional" rel="stylesheet" />
        <link rel="stylesheet" href={styles} />
        <link rel="preload" href="/images/background.webp" as="image" />
        {path === "/" && (
          <link rel="preload" href="/images/home/hero.webp" as="image" type="image/webp" fetchPriority="high" />
        )}
        
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon.png" sizes="48x48" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffde59" />

        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-B3TYEET971');`,
          }}
        />

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
            __html: `(function(){var w=window,d=document,s='script',l='dataLayer',i='G-B3TYEET971';w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+'&l='+l;function init(){f.parentNode.insertBefore(j,f);}if('requestIdleCallback'in w){w.requestIdleCallback(init,{timeout:2000})}else{setTimeout(init,2000)}})();`,
          }}
        />
      </body>
    </html>
  );
};
