"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { navigate } from "rwsdk/client";
import { Facebook, Instagram } from "lucide-react";

const menuData = [
  { id: 1, title: "Réservation", path: "/reservation" },
  { id: 2, title: "Les Studios", path: "/les-studios" },
  { id: 5, title: "L'Équipe", path: "/equipe" },
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
  const currentPath = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleStickyNavbar = () => {
      setSticky(window.scrollY >= 80);
    };
    window.addEventListener("scroll", handleStickyNavbar);
    return () => window.removeEventListener("scroll", handleStickyNavbar);
  }, []);

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavbarOpen(false);
      }
    };
    document.addEventListener("click", handleClickAway);
    return () => document.removeEventListener("click", handleClickAway);
  }, []);

  const onLogoClick = () => {
    setSpin(true);
    setTimeout(() => setSpin(false), 1000);
  };

  return (
    <header
      className={`left-0 top-0 z-40 flex w-full items-center ${
        sticky
          ? "fixed z-[9999] bg-black/80 backdrop-blur-sm transition"
          : "absolute bg-black"
      }`}
    >
      <div className="container">
        <div className="relative -mx-4 flex items-center justify-between">
          <div className="max-w-full px-4 xl:mr-6">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onLogoClick();
                navigate("/");
              }}
              className={`block w-full ${sticky ? "py-5 lg:py-2" : "py-4"}`}
            >
              <img
                src="/images/logo.png"
                alt="logo"
                width={60}
                height={60}
                className={spin ? "animate-[spin_1s_linear_1]" : "animate-pulse"}
              />
            </a>
          </div>
          <div className="flex w-full items-center justify-between px-4">
            <div className="w-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNavbarOpen(!navbarOpen);
                }}
                aria-label="Mobile Menu"
                className="absolute right-4 top-1/2 block -translate-y-1/2 rounded-lg px-3 py-[6px] ring-primary focus:ring-2 lg:hidden"
              >
                <span
                  className={`relative my-1.5 block h-0.5 w-[30px] bg-white transition-all duration-300 ${
                    navbarOpen ? "top-[7px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`relative my-1.5 block h-0.5 w-[30px] bg-white transition-all duration-300 ${
                    navbarOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`relative my-1.5 block h-0.5 w-[30px] bg-white transition-all duration-300 ${
                    navbarOpen ? "top-[-8px] -rotate-45" : ""
                  }`}
                />
              </button>
              <nav
                ref={navRef}
                className={`absolute right-0 z-30 w-[250px] rounded border-[.5px] border-white/20 bg-black px-6 py-4 duration-300 lg:visible lg:static lg:w-auto lg:border-none lg:!bg-transparent lg:p-0 lg:opacity-100 ${
                  navbarOpen
                    ? "visible top-full opacity-100"
                    : "invisible top-[120%] opacity-0"
                }`}
              >
                <ul className="block lg:flex lg:w-full lg:items-center lg:space-x-6">
                  {menuData.map((menuItem) => (
                    <li
                      key={menuItem.id}
                      className="group relative"
                    >
                      <a
                        href={menuItem.path}
                        onClick={(e) => {
                          e.preventDefault();
                          setNavbarOpen(false);
                          navigate(menuItem.path);
                        }}
                        className={`flex py-2 text-sm font-bold transition-colors lg:mr-0 lg:inline-flex lg:px-0 lg:py-6 ${
                          currentPath === menuItem.path
                            ? "text-primary underline decoration-primary decoration-2 underline-offset-8"
                            : "hover:text-primary"
                        }`}
                      >
                        {menuItem.title}
                      </a>
                    </li>
                  ))}
                  <li className="mt-4 flex gap-4 lg:ml-auto lg:mt-0">
                    <a
                      href="https://www.facebook.com/profile.php?id=100089893392179"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary transition-opacity hover:opacity-70"
                      aria-label="Facebook"
                    >
                      <Facebook className="h-5 w-5" />
                    </a>
                    <a
                      href="https://www.instagram.com/h3_studios_sucy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary transition-opacity hover:opacity-70"
                      aria-label="Instagram"
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
