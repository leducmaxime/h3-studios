import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getParisDateISO(date = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Get current hours and minutes in Paris timezone */
export function getParisNow(): { hours: number; minutes: number; dateISO: string } {
  const now = new Date();
  const parisTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [hours, minutes] = parisTime.split(":").map(Number);
  return { hours, minutes, dateISO: getParisDateISO(now) };
}
