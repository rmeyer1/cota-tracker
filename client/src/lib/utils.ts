import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

export function formatDistance(meters: number): string {
  if (meters < METERS_PER_MILE) {
    const feet = meters / METERS_PER_FOOT;
    if (feet < 100) return "< 100 ft";
    return `${Math.round(feet)} ft`;
  }
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
