/**
 * Destination-routed pin data, types, and helpers.
 * Each destination provides a DestinationPinData slice with the same shape.
 */

import { useDestination, type Destination } from "../context/DestinationContext";
import { queenstownPinData } from "./queenstownPins";
import { venicePinData } from "./venicePins";

export type PinCategory = "food" | "activity" | "scenic" | "stay" | "wellness";
export type PinChip = "eat" | "drink" | "adventure" | "scenic" | "stay";

export type Pin = {
  id: string;
  name: string;
  category: PinCategory;
  chip: PinChip;
  lat: number;
  lng: number;
  description: string;
  qcash?: number;
  rating: number;
  reviews: number;
  imgLabel: string;
};

export type PlannedStop = {
  pinId: string;
  day: string;
  time: string;
  status: "done" | "next" | "later";
};

export type DestinationPinData = {
  pins: Pin[];
  userLocation: { lat: number; lng: number };
  defaultCenter: { lat: number; lng: number; zoom: number };
  plannedTrip: PlannedStop[];
  topFiveIds: readonly string[];
};

export const pinsByDestination: Record<Destination, DestinationPinData> = {
  queenstown: queenstownPinData,
  venice: venicePinData,
};

export function usePinData(): DestinationPinData {
  const { destination } = useDestination();
  return pinsByDestination[destination];
}

export function findPin(pins: Pin[], id: string): Pin | undefined {
  return pins.find((p) => p.id === id);
}

/* ----- Distance + format ------------------------------------------------- */

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatReviews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const categoryLabels: Record<PinCategory, string> = {
  food: "Food & drink",
  activity: "Activity",
  scenic: "Scenic",
  stay: "Stay",
  wellness: "Wellness",
};

export const categoryGlyph: Record<PinCategory, string> = {
  food: "◆",
  activity: "▲",
  scenic: "●",
  stay: "■",
  wellness: "◇",
};

export const chipLabels: Record<PinChip, string> = {
  eat: "Eat",
  drink: "Drink",
  adventure: "Adventure",
  scenic: "Scenic",
  stay: "Stay",
};

export const chipOrder: PinChip[] = ["eat", "drink", "adventure", "scenic", "stay"];
