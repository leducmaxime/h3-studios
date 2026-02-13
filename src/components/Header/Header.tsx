"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { navigate } from "rwsdk/client";

const menuData = [
  { id: 1, title: "Les Studios", path: "/les-studios" },
  { id: 2, title: "Le Matériel", path: "/le-materiel" },
  { id: 3, title: "Tarifs", path: "/tarifs" },
  { id: 4, title: "Réservation", path: "/reservation" },
  { id: 5, title: "Avis", path: "/avis" },
  { id: 6, title: "À Propos", path: "/a-propos" },
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
                <ul className="block lg:flex lg:w-full lg:space-x-6">
                  {menuData.map((menuItem) => (
                    <li
                      key={menuItem.id}
                      className="group relative last:!ml-auto last:text-primary"
                    >
                      <a
                        href={menuItem.path}
                        onClick={(e) => {
                          e.preventDefault();
                          setNavbarOpen(false);
                          navigate(menuItem.path);
                        }}
                        className={`flex py-2 text-lg font-bold lg:mr-0 lg:inline-flex lg:px-0 lg:py-6 ${
                          currentPath === menuItem.path
                            ? "underline decoration-primary decoration-2 underline-offset-8"
                            : ""
                        }`}
                      >
                        {menuItem.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
