import {
  BadgePercent,
  Banknote,
  Bell,
  CalendarClock,
  CalendarDays,
  Clock,
  Crown,
  Euro,
  Flame,
  Gift,
  Headphones,
  Heart,
  Info,
  MicVocal,
  Music,
  PartyPopper,
  Percent,
  PiggyBank,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  Ticket,
  TrendingDown,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  DEFAULT_RESERVATION_BANNER_ICON,
  isReservationBannerIconKey,
  type ReservationBannerIconKey,
} from "@/lib/reservation-banner";

/** Mapping cle -> composant lucide. Doit couvrir RESERVATION_BANNER_ICON_KEYS. */
export const RESERVATION_BANNER_ICON_COMPONENTS: Record<
  ReservationBannerIconKey,
  LucideIcon
> = {
  "badge-percent": BadgePercent,
  percent: Percent,
  tag: Tag,
  ticket: Ticket,
  gift: Gift,
  "piggy-bank": PiggyBank,
  wallet: Wallet,
  banknote: Banknote,
  euro: Euro,
  "trending-down": TrendingDown,
  sparkles: Sparkles,
  star: Star,
  flame: Flame,
  zap: Zap,
  "party-popper": PartyPopper,
  crown: Crown,
  heart: Heart,
  "thumbs-up": ThumbsUp,
  clock: Clock,
  "calendar-days": CalendarDays,
  "calendar-clock": CalendarClock,
  music: Music,
  "mic-vocal": MicVocal,
  headphones: Headphones,
  info: Info,
  bell: Bell,
};

export function getReservationBannerIcon(name: unknown): LucideIcon {
  const key = isReservationBannerIconKey(name)
    ? name
    : DEFAULT_RESERVATION_BANNER_ICON;
  return RESERVATION_BANNER_ICON_COMPONENTS[key];
}

export function ReservationBannerIcon({
  name,
  className,
}: {
  name: unknown;
  className?: string;
}) {
  const Icon = getReservationBannerIcon(name);
  return <Icon className={className} aria-hidden="true" />;
}
