import { Injectable } from '@angular/core';

interface NominatimReverseResponse {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    county?: string;
    state_district?: string;
    state?: string;
    country?: string;
  };
}

const cacheStorageKey = 'care360.location.reverseGeocodeCache';
const maxCacheEntries = 100;
const requestSpacingMs = 1100;

@Injectable({ providedIn: 'root' })
export class ReverseGeocodingService {
  private readonly cache = readCache();
  private readonly pending = new Map<string, Promise<string | null>>();
  private lastRequestAt = 0;

  resolve(latitude: number | null | undefined, longitude: number | null | undefined): Promise<string | null> {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!isValidCoordinate(lat, lon)) {
      return Promise.resolve(null);
    }

    const key = coordinateKey(lat, lon);
    const cached = this.cache.get(key);
    if (cached) {
      return Promise.resolve(cached);
    }

    const existing = this.pending.get(key);
    if (existing) {
      return existing;
    }

    const request = this.reverseGeocode(lat, lon)
      .then(location => {
        if (location) {
          this.cache.set(key, location);
          writeCache(this.cache);
        }
        return location;
      })
      .finally(() => this.pending.delete(key));

    this.pending.set(key, request);
    return request;
  }

  private async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    await this.waitForRequestSlot();

    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      zoom: '10',
      addressdetails: '1',
      'accept-language': 'en'
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      return null;
    }

    return formatLocation(await response.json() as NominatimReverseResponse);
  }

  private async waitForRequestSlot(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < requestSpacingMs) {
      await new Promise(resolve => setTimeout(resolve, requestSpacingMs - elapsed));
    }
    this.lastRequestAt = Date.now();
  }
}

function formatLocation(response: NominatimReverseResponse): string | null {
  const address = response.address;
  const parts = [
    address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? address?.suburb ?? address?.county,
    address?.state_district ?? address?.state,
    address?.country
  ]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return [...new Set(parts)].join(', ');
  }

  const displayName = response.display_name?.trim();
  return displayName ? displayName.split(',').slice(0, 3).map(part => part.trim()).join(', ') : null;
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
}

function coordinateKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function readCache(): Map<string, string> {
  try {
    const raw = localStorage.getItem(cacheStorageKey);
    if (!raw) {
      return new Map();
    }

    const entries = JSON.parse(raw) as [string, string][];
    return new Map(Array.isArray(entries) ? entries.filter(isCacheEntry) : []);
  } catch {
    localStorage.removeItem(cacheStorageKey);
    return new Map();
  }
}

function writeCache(cache: Map<string, string>): void {
  try {
    const entries = [...cache.entries()].slice(-maxCacheEntries);
    localStorage.setItem(cacheStorageKey, JSON.stringify(entries));
  } catch {
    // Keep resolved locations in memory even if browser storage is unavailable.
  }
}

function isCacheEntry(value: unknown): value is [string, string] {
  return Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'string';
}
