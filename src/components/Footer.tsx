export function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-white/5 bg-black px-2 sm:px-4 py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-4 text-xs text-white/30 flex-wrap">
        <a href="/mentions-legales" className="transition-colors hover:text-primary">
          Mentions Légales
        </a>
        <span className="text-white/10">|</span>
        <a href="/politique-confidentialite" className="transition-colors hover:text-primary">
          Politique de Confidentialité
        </a>
        <span className="text-white/10">|</span>
        <a href="/conditions-de-vente" className="transition-colors hover:text-primary">
          Conditions de Vente
        </a>
        <span className="text-white/10">|</span>
        <p>© {new Date().getFullYear()} H3 Studios. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
