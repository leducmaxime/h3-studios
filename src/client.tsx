import { initClient, initClientNavigation } from "rwsdk/client";

import { syncDocumentMeta } from "@/lib/document-meta";

// RedwoodSDK ne re-rend pas le Document lors d'une navigation client : le
// <head> resterait figé sur celui de la première page chargée. On le
// resynchronise à chaque changement d'URL. `onNavigate` est appelé après le
// push d'historique, donc `location.pathname` est déjà à jour.
const { handleResponse, onHydrated } = initClientNavigation({
  onNavigate: () => syncDocumentMeta(window.location.pathname),
});

initClient({ handleResponse, onHydrated });

// `onNavigate` ne couvre que les navigations déclenchées par un lien. Les
// retours arrière / avant du navigateur passent par popstate.
window.addEventListener("popstate", () => {
  syncDocumentMeta(window.location.pathname);
});
