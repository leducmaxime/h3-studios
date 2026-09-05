import type { ReactNode } from "react";
import { Search } from "lucide-react";

// ─── Barre de filtres/tri admin ─────────────────────────────────────────────
// Motif partagé par la plupart des listes admin (Réservations, Clients,
// Paiements, Journal d'audit, Créneaux bloqués, Recouvrement...) : une carte
// contenant une recherche, plusieurs filtres et un groupe de tri.
//
// Problème résolu : ces contrôles ont des largeurs hétérogènes (recherche à
// largeur fixe, `<select>` à largeur intrinsèque dictée par leur option la
// plus longue). En `flex-wrap` sur mobile, ça retombe en lignes ragged avec
// des trous, et le groupe de tri en `ml-auto` change de position selon la
// ligne où il atterrit. `FilterBarRow` bascule sur une grille à 2 colonnes
// égales en mobile/tablette (chaque contrôle remplit sa cellule via
// `w-full` sur son propre className) et revient au `flex flex-wrap`
// d'origine à partir de `lg` — le rendu desktop actuel est inchangé.
//
// `FilterBarSort` isole le groupe de tri : pleine largeur avec séparateur en
// haut sur mobile (position stable, plus de saut selon le wrap), `ml-auto`
// sur la même ligne que les filtres à partir de `lg`, comme avant.
//
// `filterControlClass` / `filterDateInputClass` remontent la hauteur des
// `<select>`/`<input>` de `h-7` à `h-9` en mobile (cible tactile plus
// confortable) et redescendent à `h-7` à partir de `lg` — densité desktop
// inchangée. Chaque contrôle doit compléter avec `w-full lg:w-auto` (ou
// `flex-1 lg:w-auto lg:flex-none` s'il est accolé à un label).

export function FilterBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 ${className}`}>
      {children}
    </div>
  );
}

export function FilterBarRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-2 lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:gap-1.5 ${className}`}>
      {children}
    </div>
  );
}

// Groupe de tri : pleine largeur + séparateur au-dessus en mobile,
// `ml-auto` sur la ligne des filtres à partir de `lg` (comportement
// desktop d'origine).
export function FilterBarSort({ children, label = "Tri" }: { children: ReactNode; label?: string }) {
  return (
    <div className="col-span-2 flex items-center gap-1.5 border-t border-zinc-800 pt-2 lg:ml-auto lg:gap-1 lg:border-t-0 lg:pt-0">
      <span className="shrink-0 text-[10px] text-zinc-500">{label}</span>
      <div className="grid flex-1 grid-cols-2 gap-1.5 lg:flex lg:flex-none lg:gap-1">{children}</div>
    </div>
  );
}

// Champ de recherche avec icône, répété quasi à l'identique sur la plupart
// des pages listées ci-dessus. Pleine largeur (2 colonnes) en mobile, largeur
// fixe à partir de `lg` (comportement d'origine).
export function FilterSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={`relative col-span-2 lg:w-48 ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      <input
        type="text"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-sm focus:border-primary focus:outline-none lg:h-7 lg:text-xs"
      />
    </div>
  );
}

// Hauteur remontée à `h-9` en mobile (cible tactile), `h-7` à partir de `lg`
// (densité desktop d'origine). À compléter avec `w-full lg:w-auto` (bare
// select) ou `flex-1 lg:w-auto lg:flex-none` (select accolé à un label).
export const filterControlClass =
  "h-9 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-sm focus:border-primary focus:outline-none lg:h-7 lg:text-xs";

// Variante pour `<input type="date">` : padding et taille de police d'origine
// (déjà `text-base` en mobile pour éviter le zoom iOS), seule la hauteur
// change.
export const filterDateInputClass =
  "h-9 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 text-base focus:border-primary focus:outline-none lg:h-7 lg:text-sm";
