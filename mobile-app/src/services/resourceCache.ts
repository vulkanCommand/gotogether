import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEntry<T> = {
  updatedAt: number;
  value: T;
};

const CACHE_PREFIX = 'gotogether-cache:';
const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export const CACHE_TTLS = {
  profile: 5 * 60 * 1000,
  home: 60 * 1000,
  trips: 90 * 1000,
  tripDetails: 90 * 1000,
  itinerary: 60 * 1000,
  expenseGroups: 60 * 1000,
} as const;

export const cacheKeys = {
  home: 'home',
  trips: 'trips',
  tripDetails: (tripId: number) => `trip:${tripId}:details`,
  itinerary: (tripId: number) => `trip:${tripId}:itinerary`,
  expenseGroups: (tripId: number) => `trip:${tripId}:expense-groups`,
};

const cacheStorageKey = (key: string) => `${CACHE_PREFIX}${key}`;

export function isCacheFresh(updatedAt: number, maxAgeMs: number) {
  return Date.now() - updatedAt <= maxAgeMs;
}

export async function readCachedValue<T>(key: string): Promise<CacheEntry<T> | null> {
  const memoryHit = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (memoryHit) {
    return memoryHit;
  }

  try {
    const raw = await AsyncStorage.getItem(cacheStorageKey(key));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEntry<T>;

    if (!parsed || typeof parsed.updatedAt !== 'number' || !('value' in parsed)) {
      return null;
    }

    memoryCache.set(key, parsed as CacheEntry<unknown>);
    return parsed;
  } catch (error) {
    console.log('Cache read failed', key, error);
    return null;
  }
}

export async function writeCachedValue<T>(key: string, value: T) {
  const entry: CacheEntry<T> = {
    updatedAt: Date.now(),
    value,
  };

  memoryCache.set(key, entry as CacheEntry<unknown>);

  try {
    await AsyncStorage.setItem(cacheStorageKey(key), JSON.stringify(entry));
  } catch (error) {
    console.log('Cache write failed', key, error);
  }

  return entry;
}

export async function fetchWithCache<T>(
  key: string,
  maxAgeMs: number,
  fetcher: () => Promise<T>,
  options: { force?: boolean } = {}
) {
  const cached = await readCachedValue<T>(key);

  if (!options.force && cached && isCacheFresh(cached.updatedAt, maxAgeMs)) {
    return {
      data: cached.value,
      updatedAt: cached.updatedAt,
      fromCache: true,
    };
  }

  const existingRequest = inFlight.get(key) as Promise<T> | undefined;

  if (existingRequest) {
    const data = await existingRequest;
    return {
      data,
      updatedAt: Date.now(),
      fromCache: false,
    };
  }

  const request = fetcher();
  inFlight.set(key, request);

  try {
    const data = await request;
    const entry = await writeCachedValue(key, data);
    return {
      data,
      updatedAt: entry.updatedAt,
      fromCache: false,
    };
  } finally {
    inFlight.delete(key);
  }
}

export async function invalidateCacheKey(key: string) {
  memoryCache.delete(key);
  inFlight.delete(key);

  try {
    await AsyncStorage.removeItem(cacheStorageKey(key));
  } catch (error) {
    console.log('Cache invalidate failed', key, error);
  }
}

export async function invalidateTripCaches(tripId: number) {
  await Promise.all([
    invalidateCacheKey(cacheKeys.home),
    invalidateCacheKey(cacheKeys.trips),
    invalidateCacheKey(cacheKeys.tripDetails(tripId)),
    invalidateCacheKey(cacheKeys.itinerary(tripId)),
    invalidateCacheKey(cacheKeys.expenseGroups(tripId)),
  ]);
}
