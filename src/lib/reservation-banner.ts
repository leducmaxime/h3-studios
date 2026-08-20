/**
 * Bandeau promotionnel affiche sur la page publique /reservation
 * (etape "creneau", avant le choix du studio).
 *
 * Le titre et la description sont configurables par type de groupe
 * depuis /admin/settings. Les valeurs par defaut ci-dessous servent
 * de fallback quand la cle n'existe pas en base ou est vide.
 */

export type ReservationBannerGroupKey = "solo" | "duo" | "group";

export type ReservationBannerField = "title" | "description" | "icon";

/**
 * Liste blanche d'icones selectionnables depuis l'admin.
 * Chaque cle correspond a une icone lucide-react mappee dans
 * `src/components/common/ReservationBannerIcon.tsx`. Une liste fermee
 * evite d'embarquer toute la librairie lucide dans le bundle.
 */
export const RESERVATION_BANNER_ICON_KEYS = [
  "badge-percent",
  "percent",
  "tag",
  "ticket",
  "gift",
  "piggy-bank",
  "wallet",
  "banknote",
  "euro",
  "trending-down",
  "sparkles",
  "star",
  "flame",
  "zap",
  "party-popper",
  "crown",
  "heart",
  "thumbs-up",
  "clock",
  "calendar-days",
  "calendar-clock",
  "music",
  "mic-vocal",
  "headphones",
  "info",
  "bell",
] as const;

export type ReservationBannerIconKey =
  (typeof RESERVATION_BANNER_ICON_KEYS)[number];

export const RESERVATION_BANNER_ICON_LABELS: Record<
  ReservationBannerIconKey,
  string
> = {
  "badge-percent": "Badge pourcentage",
  percent: "Pourcentage",
  tag: "\u00c9tiquette",
  ticket: "Ticket",
  gift: "Cadeau",
  "piggy-bank": "Tirelire",
  wallet: "Portefeuille",
  banknote: "Billet",
  euro: "Euro",
  "trending-down": "Courbe descendante",
  sparkles: "\u00c9tincelles",
  star: "\u00c9toile",
  flame: "Flamme",
  zap: "\u00c9clair",
  "party-popper": "Confettis",
  crown: "Couronne",
  heart: "C\u0153ur",
  "thumbs-up": "Pouce lev\u00e9",
  clock: "Horloge",
  "calendar-days": "Calendrier",
  "calendar-clock": "Calendrier horaire",
  music: "Note de musique",
  "mic-vocal": "Micro",
  headphones: "Casque",
  info: "Information",
  bell: "Cloche",
};

export const DEFAULT_RESERVATION_BANNER_ICON: ReservationBannerIconKey =
  "badge-percent";

export function isReservationBannerIconKey(
  value: unknown,
): value is ReservationBannerIconKey {
  return (
    typeof value === "string" &&
    (RESERVATION_BANNER_ICON_KEYS as readonly string[]).includes(value)
  );
}

export interface ReservationBannerEntry {
  title: string;
  description: string;
  icon: ReservationBannerIconKey;
}

export type ReservationBanner = Record<
  ReservationBannerGroupKey,
  ReservationBannerEntry
>;

export const RESERVATION_BANNER_GROUP_KEYS: ReservationBannerGroupKey[] = [
  "solo",
  "duo",
  "group",
];

export const RESERVATION_BANNER_GROUP_LABELS: Record<
  ReservationBannerGroupKey,
  string
> = {
  solo: "Solo",
  duo: "Duo",
  group: "Groupe",
};

export const RESERVATION_BANNER_TITLE_MAX_LENGTH = 80;
export const RESERVATION_BANNER_DESCRIPTION_MAX_LENGTH = 300;

const DEFAULT_DESCRIPTION =
  "Les tarifs varient selon l'heure (apr\u00e8s 18h) et le jour (weekend et jour f\u00e9ri\u00e9) : r\u00e9servez avant 18h en semaine pour en profiter.";

export const DEFAULT_RESERVATION_BANNER: ReservationBanner = {
  solo: {
    title: "Plus de 70% de r\u00e9duction",
    description: DEFAULT_DESCRIPTION,
    icon: DEFAULT_RESERVATION_BANNER_ICON,
  },
  duo: {
    title: "Plus de 45% de r\u00e9duction",
    description: DEFAULT_DESCRIPTION,
    icon: DEFAULT_RESERVATION_BANNER_ICON,
  },
  group: {
    title: "Jusqu'\u00e0 20% d'\u00e9conomie",
    description: DEFAULT_DESCRIPTION,
    icon: DEFAULT_RESERVATION_BANNER_ICON,
  },
};

/** Cle `settings` correspondante, ex: `reservation.banner.solo.title`. */
export function reservationBannerSettingKey(
  group: ReservationBannerGroupKey,
  field: ReservationBannerField,
): string {
  return `reservation.banner.${group}.${field}`;
}

/** Toutes les cles `settings` du bandeau, dans l'ordre d'affichage. */
export const RESERVATION_BANNER_SETTING_KEYS: string[] =
  RESERVATION_BANNER_GROUP_KEYS.flatMap((group) => [
    reservationBannerSettingKey(group, "title"),
    reservationBannerSettingKey(group, "description"),
    reservationBannerSettingKey(group, "icon"),
  ]);

/**
 * Construit le bandeau complet a partir d'une map de settings
 * (valeurs brutes issues de la table `settings`), en retombant sur
 * les valeurs par defaut si absentes ou vides.
 */
export function resolveReservationBanner(
  values: Partial<Record<string, string | null | undefined>>,
): ReservationBanner {
  const resolveText = (
    group: ReservationBannerGroupKey,
    field: "title" | "description",
  ): string => {
    const raw = values[reservationBannerSettingKey(group, field)];
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed || DEFAULT_RESERVATION_BANNER[group][field];
  };

  const resolveIcon = (
    group: ReservationBannerGroupKey,
  ): ReservationBannerIconKey => {
    const raw = values[reservationBannerSettingKey(group, "icon")];
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return isReservationBannerIconKey(trimmed)
      ? trimmed
      : DEFAULT_RESERVATION_BANNER[group].icon;
  };

  const resolveEntry = (
    group: ReservationBannerGroupKey,
  ): ReservationBannerEntry => ({
    title: resolveText(group, "title"),
    description: resolveText(group, "description"),
    icon: resolveIcon(group),
  });

  return {
    solo: resolveEntry("solo"),
    duo: resolveEntry("duo"),
    group: resolveEntry("group"),
  };
}
