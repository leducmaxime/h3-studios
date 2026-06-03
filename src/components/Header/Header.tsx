"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { navigate } from "rwsdk/client";
import { Facebook, Instagram, User, LogOut, UserCircle, CalendarDays, Phone } from "lucide-react";

const menuData = [
  { id: 1, title: "Réservation", path: "/reservation" },
  { id: 2, title: "Les Studios", path: "/les-studios" },
  { id: 5, title: "L'Équipe", path: "/equipe" },
  { id: 8, title: "Actualités", path: "/actualites" },
  { id: 4, title: "Avis", path: "/avis" },
  { id: 7, title: "À Propos", path: "/a-propos" },
];

function usePathname() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener("popstate", callback);
      
      const originalPushState = history.pushState.bind(history);
      const originalReplaceState = history.replaceState.bind(history);
      
      history.pushState = (...args) => {
        originalPushState(...args);
        callback();
      };
      history.replaceState = (...args) => {
        originalReplaceState(...args);
        callback();
      };
      
      return () => {
        window.removeEventListener("popstate", callback);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
      };
    },
    () => window.location.pathname,
    () => "/"
  );
}

export function Header() {
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [spin, setSpin] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const currentPath = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.getElementById("root");
    const handleStickyNavbar = () => {
      const scrollY = root ? root.scrollTop : window.scrollY;
      setSticky(scrollY >= 10);
    };
    handleStickyNavbar();
    const target = root || window;
    target.addEventListener("scroll", handleStickyNavbar);
    return () => target.removeEventListener("scroll", handleStickyNavbar);
  }, []);

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavbarOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("click", handleClickAway);
    return () => document.removeEventListener("click", handleClickAway);
  }, []);

  useEffect(() => {
    fetch("/api/client/me")
      .then((res) => res.json())
      .then((data) => {
        setIsLoggedIn(!!data?.data);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  const onLogoClick = () => {
    setSpin(true);
    setTimeout(() => setSpin(false), 1000);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/client/logout", { method: "POST" });
      setIsLoggedIn(false);
      setProfileOpen(false);
      window.location.reload();
    } catch {
      setProfileOpen(false);
    }
  };

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 font-secondary transition-all duration-300 ${
        sticky ? "bg-black border-b border-zinc-800" : "bg-transparent"
      }`}
    >
      <div className="container">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onLogoClick();
              navigate("/");
            }}
            className="flex items-center gap-2.5 group"
          >
            <img
              src="/images/logo.webp"
              alt="logo"
              width={48}
              height={48}
              fetchPriority="high"
              decoding="async"
              className={spin ? "animate-[spin_1s_linear_1]" : "animate-pulse"}
            />
          </a>

          <nav className="hidden lg:flex items-center gap-1">
            {menuData.map((menuItem) => (
              <a
                key={menuItem.id}
                href={menuItem.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(menuItem.path);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPath === menuItem.path
                    ? "text-primary bg-primary/10"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {menuItem.title}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2">
              <a
                href="https://www.facebook.com/profile.php?id=100089893392179"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-white/70 transition-all duration-200 hover:text-white hover:bg-white/10"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/h3_studios_sucy/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-white/70 transition-all duration-200 hover:text-white hover:bg-white/10"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>

            <a
              href="tel:0613440875"
              className="lg:hidden flex items-center justify-center rounded-lg p-2 text-white/70 transition-all duration-200 hover:text-primary"
              aria-label="Téléphone"
            >
              <Phone className="h-5 w-5" />
            </a>

            <div className="relative" ref={profileRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileOpen(!profileOpen);
                }}
                className="flex items-center justify-center rounded-lg p-2 text-white/70 transition-all duration-200 hover:text-white hover:bg-white/10"
                aria-label="Profil"
              >
                <User className="h-5 w-5" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-white/20 bg-black py-2 shadow-xl">
                  {isLoggedIn ? (
                    <>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          navigate("/mon-compte/profil");
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/10 hover:text-primary"
                      >
                        <UserCircle className="h-4 w-4 text-primary" />
                        Mon Profil
                      </button>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          navigate("/mon-compte");
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/10 hover:text-primary"
                      >
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Mes Réservations
                      </button>
                      <div className="my-1 border-t border-white/10" />
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-white/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Déconnexion
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/mon-compte/connexion");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-white/10 hover:text-primary"
                    >
                      <UserCircle className="h-4 w-4 text-primary" />
                      Connexion
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setNavbarOpen(!navbarOpen);
              }}
              aria-label="Mobile Menu"
              className="lg:hidden rounded-lg p-2 text-white/70 transition-all duration-200 hover:text-white hover:bg-white/10"
            >
              <span
                className={`relative my-1.5 block h-0.5 w-[24px] bg-current transition-all duration-300 ${
                  navbarOpen ? "top-[7px] rotate-45" : ""
                }`}
              />
              <span
                className={`relative my-1.5 block h-0.5 w-[24px] bg-current transition-all duration-300 ${
                  navbarOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`relative my-1.5 block h-0.5 w-[24px] bg-current transition-all duration-300 ${
                  navbarOpen ? "top-[-8px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <nav
        ref={navRef}
        className={`lg:hidden absolute left-0 right-0 top-full bg-black/95 backdrop-blur-sm border-b border-white/10 transition-all duration-300 ${
          navbarOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="container py-4">
          <div className="flex flex-col gap-1">
            {menuData.map((menuItem) => (
              <a
                key={menuItem.id}
                href={menuItem.path}
                onClick={(e) => {
                  e.preventDefault();
                  setNavbarOpen(false);
                  navigate(menuItem.path);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPath === menuItem.path
                    ? "text-primary bg-primary/10"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {menuItem.title}
              </a>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
            <a
              href="https://www.facebook.com/profile.php?id=100089893392179"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-white/70 transition-all duration-200 hover:text-white hover:bg-white/10"
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a
              href="https://www.instagram.com/h3_studios_sucy/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-white/70 transition-all duration-200 hover:text-white hover:bg-white/10"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
