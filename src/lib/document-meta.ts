import { SITE_URL, pageSEO, type PageSEO } from "@/app/seo";

/**
 * Synchronisation du <head> lors des navigations client (SPA).
 *
 * RedwoodSDK ne re-rend pas le Document lors d'une navigation client : seul
 * l'arbre RSC sous <body> est remplacé, et le <head> produit au rendu serveur
 * initial reste en place. Sans ce module, l'onglet, l'historique, les favoris
 * et le suivi analytics conservent indéfiniment le titre de la première page
 * visitée.
 *
 * Le rendu serveur n'est volontairement pas touché : les crawlers ne font pas
 * de navigation client, ils reçoivent déjà le bon <head> à chaque requête. Ce
 * module ne corrige donc que l'expérience des visiteurs humains, sans aucun
 * risque de régression SEO.
 *
 * `src/app/seo.ts` reste la source de vérité unique : on lit la même table
 * `pageSEO` que `Document.tsx`, plutôt que d'en dupliquer une copie qui
 * dériverait avec le temps.
 */

/**
 * Résout l'entrée SEO d'un chemin comme le fait le rendu serveur.
 *
 * `Document.tsx` ne reçoit pas l'URL réelle mais le `path` du groupe de routes
 * (`<DocumentWithPath path="/reservation">`). Une URL d'étape comme
 * `/reservation/participants` doit donc résoudre vers l'entrée `/reservation`.
 * On tente une correspondance exacte, puis la clé la plus longue qui soit un
 * préfixe de segment du chemin, et enfin l'accueil — même repli que le serveur.
 */
export function resolvePageSEO(pathname: string): PageSEO {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  const exact = pageSEO[path];
  if (exact) return exact;

  let best: PageSEO | undefined;
  let bestLength = 0;
  for (const [key, entry] of Object.entries(pageSEO)) {
    if (key === "/") continue;
    if ((path === key || path.startsWith(`${key}/`)) && key.length > bestLength) {
      best = entry;
      bestLength = key.length;
    }
  }

  return best ?? pageSEO["/"];
}

/** Écrit `value` dans l'attribut `attribute` du premier élément correspondant, s'il existe. */
function setAttribute(selector: string, attribute: string, value: string): void {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

/**
 * Aligne le <head> courant sur le chemin donné.
 *
 * Ne met à jour que les balises qui dépendent réellement de la page. Celles qui
 * sont constantes sur tout le site (og:image, og:locale, géolocalisation,
 * theme-color…) sont laissées telles quelles, et les pages d'administration
 * sont ignorées pour ne pas toucher à leur `robots: noindex`.
 */
export function syncDocumentMeta(pathname: string): void {
  if (pathname.startsWith("/admin")) return;

  const seo = resolvePageSEO(pathname);
  const canonicalUrl = `${SITE_URL}${seo.path}`;

  document.title = seo.title;

  setAttribute('meta[name="title"]', "content", seo.title);
  setAttribute('meta[name="description"]', "content", seo.description);
  setAttribute('meta[name="keywords"]', "content", seo.keywords.join(", "));

  setAttribute('link[rel="canonical"]', "href", canonicalUrl);

  setAttribute('meta[property="og:url"]', "content", canonicalUrl);
  setAttribute('meta[property="og:title"]', "content", seo.title);
  setAttribute('meta[property="og:description"]', "content", seo.description);

  setAttribute('meta[name="twitter:url"]', "content", canonicalUrl);
  setAttribute('meta[name="twitter:title"]', "content", seo.title);
  setAttribute('meta[name="twitter:description"]', "content", seo.description);
}
