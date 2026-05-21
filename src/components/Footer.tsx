import { Facebook, Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-white/5 bg-black px-2 sm:px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/40 sm:gap-6">
          <a href="/mentions-legales" className="transition-colors hover:text-primary">
            Mentions Légales
          </a>
          <span className="hidden sm:inline text-white/10">|</span>
          <a href="/politique-confidentialite" className="transition-colors hover:text-primary">
            Politique de Confidentialité
          </a>
          <span className="hidden sm:inline text-white/10">|</span>
          <a href="/conditions-de-vente" className="transition-colors hover:text-primary">
            Conditions de Vente
          </a>
        </div>

        {/* Social + Copyright */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/profile.php?id=100089893392179"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full p-2 text-white/40 transition-colors hover:text-primary"
              aria-label="Facebook"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href="https://www.instagram.com/h3_studios_sucy/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full p-2 text-white/40 transition-colors hover:text-primary"
              aria-label="Instagram"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>
          <p className="text-[11px] text-white/30">
            © {new Date().getFullYear()} H3 Studios. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
