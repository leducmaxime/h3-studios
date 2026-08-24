import { navigate } from "rwsdk/client";

export type AccountPage = "reservations" | "profile" | "loyalty";

export const ACCOUNT_HREF: Record<AccountPage, string> = {
  reservations: "/mon-compte",
  profile: "/mon-compte/profil",
  loyalty: "/mon-compte/fidelite",
};

export function isAccountWorkspacePath(pathname: string): boolean {
  return pathname === "/mon-compte" || pathname === "/mon-compte/profil" || pathname === "/mon-compte/fidelite";
}

export function accountPageFromPath(pathname: string): AccountPage {
  if (pathname === "/mon-compte/profil") return "profile";
  if (pathname === "/mon-compte/fidelite") return "loyalty";
  return "reservations";
}

export function goToAccountPage(page: AccountPage): void {
  const href = ACCOUNT_HREF[page];
  if (typeof window === "undefined") return;
  if (isAccountWorkspacePath(window.location.pathname)) {
    if (window.location.pathname !== href) {
      window.history.pushState({}, "", href);
    }
    return;
  }
  navigate(href);
}
