import { describe, expect, it } from "vitest";
import { buildSessionCookie, clearSessionCookie } from "@/lib/auth";

/**
 * Régression : l'application installée sur l'écran d'accueil (WebAPK Android)
 * est lancée par un intent. Avec SameSite=Strict, Chrome ne joignait pas le
 * cookie à la première navigation vers /admin et l'administrateur se retrouvait
 * déconnecté à chaque réouverture — alors que la session restait valide dans un
 * onglet Chrome normal sur le même téléphone.
 */
describe("cookie de session admin", () => {
  it("utilise SameSite=Lax pour survivre au lancement de l'application installée", () => {
    const cookie = buildSessionCookie("jeton-test");

    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("SameSite=Strict");
  });

  it("reste persistant, protégé et limité à l'origine", () => {
    const cookie = buildSessionCookie("jeton-test");

    // Persistant : sans Max-Age, la fermeture de l'application suffirait à
    // perdre la session, indépendamment de SameSite.
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
    // Pas d'attribut Domain : le cookie reste lié au seul hôte courant.
    expect(cookie).not.toContain("Domain=");
  });

  it("respecte une durée personnalisée", () => {
    expect(buildSessionCookie("jeton-test", 1)).toContain("Max-Age=86400");
  });

  it("efface la session avec les mêmes attributs", () => {
    const cookie = clearSessionCookie();

    // Les attributs doivent correspondre, sinon le navigateur refuse de
    // remplacer le cookie existant et la déconnexion échoue silencieusement.
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=0");
  });
});
