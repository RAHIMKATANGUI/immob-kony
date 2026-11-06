import { tooMany } from "./errors";

/**
 * Limiteur de débit en mémoire (fenêtre glissante).
 * Pour plusieurs instances, remplacer le store par Redis (Upstash, Render Key Value…).
 */
type Bucket = { hits: number[] };
const store = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
    store.set(key, bucket);
    return { ok: false as const, retryAfter };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  if (store.size > 10_000) {
    for (const [k, b] of store) if (!b.hits.some((t) => now - t < windowMs)) store.delete(k);
  }
  return { ok: true as const, remaining: limit - bucket.hits.length };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) throw tooMany(`Trop de requêtes. Réessayez dans ${r.retryAfter}s.`);
}

export function resetRateLimit(key: string) {
  store.delete(key);
}
