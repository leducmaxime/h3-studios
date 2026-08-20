/**
 * Bandeau promotionnel affiche sur la page publique /reservation
 * (etape "creneau", avant le choix du studio).
 *
 * Le titre et la description sont configurables par type de groupe
 * depuis /admin/settings. Les valeurs par defaut ci-dessous servent
 * de fallback quand la cle n'existe pas en base ou est vide.
 */

export type ReservationBannerGroupKey = "solo" | "duo" | "group";

export type ReservationBannerField = "title" | "description";

export interface ReservationBannerEntry {
  title: string;
  description: string;
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
  },
  duo: {
    title: "Plus de 45% de r\u00e9duction",
    description: DEFAULT_DESCRIPTION,
  },
  group: {
    title: "Jusqu'\u00e0 20% d'\u00e9conomie",
    description: DEFAULT_DESCRIPTION,
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
  ]);

/**
 * Construit le bandeau complet a partir d'une map de settings
 * (valeurs brutes issues de la table `settings`), en retombant sur
 * les valeurs par defaut si absentes ou vides.
 */
export function resolveReservationBanner(
  values: Partial<Record<string, string | null | undefined>>,
): ReservationBanner {
  const resolveField = (
    group: ReservationBannerGroupKey,
    field: ReservationBannerField,
  ): string => {
    const raw = values[reservationBannerSettingKey(group, field)];
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed || DEFAULT_RESERVATION_BANNER[group][field];
  };

  return {
    solo: {
      title: resolveField("solo", "title"),
      description: resolveField("solo", "description"),
    },
    duo: {
      title: resolveField("duo", "title"),
      description: resolveField("duo", "description"),
    },
    group: {
      title: resolveField("group", "title"),
      description: resolveField("group", "description"),
    },
  };
}
