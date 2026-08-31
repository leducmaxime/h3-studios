// Service worker de l'admin H3 Studios — notifications push uniquement.
//
// IMPORTANT : ne JAMAIS ajouter d'écouteur "fetch" ici, même en passthrough.
// Un tel écouteur ferait transiter toutes les requêtes /admin/* par ce worker ;
// la moindre erreur de cache pourrait servir un chunk de route obsolète contre
// une coquille SSR fraîche et casser durablement le panneau admin (écran blanc
// persistant, y compris après rechargement). On ne gère que "push" et
// "notificationclick".

const FALLBACK_TITLE = "H3 Studios";
const FALLBACK_BODY = "Nouvelle notification";
const FALLBACK_ICON = "/icon-192.png";

self.addEventListener("install", () => {
  // Active la nouvelle version immédiatement, sans attendre la fermeture
  // des onglets ouverts.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Prend le contrôle des pages déjà ouvertes sans attendre un rechargement.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    // Payload absent ou non JSON : on retombe sur le message par défaut.
    payload = null;
  }

  const title = (payload && payload.title) || FALLBACK_TITLE;
  const body = (payload && payload.body) || FALLBACK_BODY;
  const data = (payload && payload.data) || {};

  // showNotification DOIT toujours être appelé : un push silencieux (qui
  // n'affiche rien) est pénalisé par iOS et peut désactiver l'abonnement
  // sans avertissement.
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: FALLBACK_ICON,
      badge: FALLBACK_ICON,
      tag: data.tag || "h3-notification",
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          // Réutilise un onglet admin déjà ouvert plutôt que d'en ouvrir un nouveau.
          if (client.url.includes("/admin") && "focus" in client) {
            // On renvoie bien la promesse : sans cela, waitUntil peut laisser le
            // service worker s'endormir avant que le focus/la navigation aient
            // abouti, et le clic paraît sans effet.
            return Promise.resolve(client.focus())
              .then((focused) => {
                const target = focused || client;
                // navigate() n'existe pas partout (notamment sur iOS) : on
                // ignore l'échec plutôt que de casser le clic, l'onglet restant
                // au moins ramené au premier plan.
                if (typeof target.navigate === "function") {
                  return target.navigate(targetUrl).catch(() => undefined);
                }
                return undefined;
              })
              .catch(() => undefined);
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
