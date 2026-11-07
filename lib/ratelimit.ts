/**
 * Simple in-memory rate limiter for server-side API routes.
 * Uses a sliding window counter per key.
 * NOTE: This is per-process only. For multi-process deployments, use Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 5 * 60_000);
}

export interface RateLimitConfig {
  /** Max requests in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // Start a new window
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/** Rate limit configs for each protected route type */
export const RATE_LIMITS = {
  /** AI-backed routes: 20 requests per minute per workspace */
  AI: { limit: 20, windowMs: 60_000 } satisfies RateLimitConfig,
  /** Payment execution: 10 per minute per workspace */
  PAYMENT: { limit: 10, windowMs: 60_000 } satisfies RateLimitConfig,
  /** General API: 60 per minute per workspace */
  API: { limit: 60, windowMs: 60_000 } satisfies RateLimitConfig,
} as const;
