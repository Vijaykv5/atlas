export type AtlasMemory = {
  id: string;
  title: string;
  country: string;
  kind: string;
  creator?: string;
  txHash?: string;
  description?: string;
  imageCid?: string;
  imageDataUrl?: string;
  voiceDataUrl?: string;
  createdAt?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
};

export type CountryStat = {
  country: string;
  count: number;
};

export const COUNTRY_ALIASES: Record<string, string> = {
  england: "United Kingdom",
  "great britain": "United Kingdom",
  "united kingdom": "United Kingdom",
  uk: "United Kingdom",
  usa: "USA",
  us: "USA",
  "u.s.a.": "USA",
  "u.s.": "USA",
  "united states": "USA",
  "united states of america": "USA",
  "united arab emirates": "UAE",
  uae: "UAE",
};

export const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  USA: { lat: 37.0902, lng: -95.7129 },
  Canada: { lat: 56.1304, lng: -106.3468 },
  Brazil: { lat: -14.235, lng: -51.9253 },
  Peru: { lat: -9.19, lng: -75.0152 },
  "United Kingdom": { lat: 55.3781, lng: -3.436 },
  France: { lat: 46.2276, lng: 2.2137 },
  Germany: { lat: 51.1657, lng: 10.4515 },
  Nigeria: { lat: 9.082, lng: 8.6753 },
  Ghana: { lat: 7.9465, lng: -1.0232 },
  India: { lat: 20.5937, lng: 78.9629 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
  Malaysia: { lat: 4.2105, lng: 101.9758 },
  Japan: { lat: 36.2048, lng: 138.2529 },
  Australia: { lat: -25.2744, lng: 133.7751 },
};

export const ATLAS_MEMORIES: AtlasMemory[] = [
  {
    id: "lima-sunrise",
    title: "Sunrise memory above Lima",
    country: "Peru",
    kind: "story",
    coordinates: { lat: -12.0464, lng: -77.0428 },
  },
  {
    id: "osaka-noodles",
    title: "Rain outside a noodle shop",
    country: "Japan",
    kind: "photo",
    coordinates: { lat: 34.6937, lng: 135.5023 },
  },
  {
    id: "accra-street",
    title: "Grandmother's street in Accra",
    country: "Ghana",
    kind: "story",
    coordinates: { lat: 5.6037, lng: -0.187 },
  },
  {
    id: "singapore-ferry",
    title: "Midnight ferry recording",
    country: "Singapore",
    kind: "voice",
    coordinates: { lat: 1.3521, lng: 103.8198 },
  },
  {
    id: "kerala-rain",
    title: "Monsoon video from Kerala",
    country: "India",
    kind: "video",
    coordinates: { lat: 10.8505, lng: 76.2711 },
  },
  {
    id: "london-station",
    title: "Last train from King's Cross",
    country: "United Kingdom",
    kind: "photo",
    coordinates: { lat: 51.5072, lng: -0.1276 },
  },
  {
    id: "berlin-courtyard",
    title: "Courtyard song in Berlin",
    country: "Germany",
    kind: "voice",
    coordinates: { lat: 52.52, lng: 13.405 },
  },
  {
    id: "vancouver-harbor",
    title: "Harbor fog after the call",
    country: "Canada",
    kind: "story",
    coordinates: { lat: 49.2827, lng: -123.1207 },
  },
  {
    id: "rio-steps",
    title: "Steps glowing after carnival",
    country: "Brazil",
    kind: "video",
    coordinates: { lat: -22.9068, lng: -43.1729 },
  },
  {
    id: "sydney-rooftop",
    title: "A rooftop toast in Sydney",
    country: "Australia",
    kind: "photo",
    coordinates: { lat: -33.8688, lng: 151.2093 },
  },
];

export const MEMORY_ARCS = [
  { startLat: -12.0464, startLng: -77.0428, endLat: 34.6937, endLng: 135.5023 },
  { startLat: 5.6037, startLng: -0.187, endLat: 51.5072, endLng: -0.1276 },
  { startLat: 10.8505, startLng: 76.2711, endLat: 1.3521, endLng: 103.8198 },
  { startLat: -22.9068, startLng: -43.1729, endLat: 49.2827, endLng: -123.1207 },
];

export function normalizeCountry(rawCountry: string | null | undefined): string | null {
  if (!rawCountry) {
    return null;
  }

  const trimmed = rawCountry.trim();
  if (!trimmed) {
    return null;
  }

  return COUNTRY_ALIASES[trimmed.toLowerCase()] || trimmed;
}

export function getGeoCountryName(feature: {
  properties?: Record<string, unknown>;
} | null): string | null {
  if (!feature?.properties) {
    return null;
  }

  const raw =
    (feature.properties.name as string | undefined) ||
    (feature.properties.ADMIN as string | undefined) ||
    (feature.properties.NAME as string | undefined) ||
    null;

  return raw?.trim() || null;
}

export function getCountryStats(memories: AtlasMemory[]): CountryStat[] {
  const map = new Map<string, number>();

  for (const memory of memories) {
    const country = normalizeCountry(memory.country);
    if (country) {
      map.set(country, (map.get(country) || 0) + 1);
    }
  }

  return [...map.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}
