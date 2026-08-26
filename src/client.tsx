import { initClient, initClientNavigation } from "rwsdk/client";

import { syncDocumentMeta } from "@/lib/document-meta";

const { handleResponse, onHydrated } = initClientNavigation();

// RedwoodSDK ne re-rend pas le Document lors d'une navigation client : seul
// l'arbre RSC sous <body> est remplacé, donc le <head> resterait figé sur celui
// de la première page chargée. On le resynchronise après chaque navigation.
//
// On s'accroche à `onHydrated`, que `initClient` appelle depuis un effet piloté
// par le payload RSC : il est donc rejoué à chaque navigation committée, y
// compris sur les retours arrière du navigateur (rwsdk relance une requête RSC
// sur popstate). À ce moment l'URL est déjà à jour.
//
// Ne PAS utiliser l'option `onNavigate` de `initClientNavigation` : dans la
// version installée (rwsdk 1.0.0-beta.47) elle est typée et documentée en
// JSDoc, mais n'est jamais appelée dans le corps de la fonction. Un correctif
// branché dessus est silencieusement mort.
initClient({
  handleResponse,
  onHydrated: () => {
    onHydrated();
    syncDocumentMeta(window.location.pathname);
  },
});
