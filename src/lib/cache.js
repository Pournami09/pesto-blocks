import {
  STORAGE_CACHE,
  STORAGE_CACHE_TS,
  CACHE_TTL_MS,
} from './constants.js';
import { queryAllRows } from './notion-api.js';
import { buildIndex } from './matcher.js';

/**
 * Get cached index data if it exists and hasn't expired.
 * Returns the index array or null if cache is stale/missing.
 */
export async function getCachedData() {
  const result = await chrome.storage.local.get([STORAGE_CACHE, STORAGE_CACHE_TS]);
  const data = result[STORAGE_CACHE];
  const ts = result[STORAGE_CACHE_TS];

  if (!data || !ts) return null;
  if (Date.now() - ts > CACHE_TTL_MS) return null;

  return data;
}

/**
 * Store index data in the cache with a current timestamp.
 */
export async function setCachedData(data) {
  await chrome.storage.local.set({
    [STORAGE_CACHE]: data,
    [STORAGE_CACHE_TS]: Date.now(),
  });
}

/**
 * Clear the cache.
 */
export async function clearCache() {
  await chrome.storage.local.remove([STORAGE_CACHE, STORAGE_CACHE_TS]);
}

/**
 * Get the search index, using cache if fresh, otherwise fetching from Notion.
 * Returns the index array.
 */
export async function getOrFetch(token, dbId) {
  const cached = await getCachedData();
  if (cached) return cached;

  const rows = await queryAllRows(token, dbId);
  const index = buildIndex(rows);
  await setCachedData(index);
  return index;
}
