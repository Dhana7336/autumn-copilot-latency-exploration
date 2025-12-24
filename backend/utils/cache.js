/**
 * In-Memory TTL Cache
 * Simple process-local cache for AI chatbot responses
 *
 * Scope:
 * - AI chatbot analysis
 * - Competitor comparisons
 * - Promotion simulations / previews
 */

class TTLCache {
  constructor(defaultTTL = 300000) { // Default 5 minutes
    this.cache = new Map();
    this.defaultTTL = defaultTTL;

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Generate cache key from request parameters
   * @param {string} type - Cache type (analysis, competitor, simulation)
   * @param {object} params - Request parameters
   * @returns {string} Cache key
   */
  generateKey(type, params) {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    return `${type}:${this._hash(normalized)}`;
  }

  /**
   * Simple hash function for cache keys
   */
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached value if not expired
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.value;
  }

  /**
   * Set cache value with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      hits: 0
    });
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Clear cache entries by type prefix
   * @param {string} type - Cache type prefix
   */
  clearByType(type) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${type}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Remove expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    const stats = {
      totalEntries: this.cache.size,
      byType: {},
      totalHits: 0,
      oldestEntry: null,
      newestEntry: null
    };

    for (const [key, entry] of this.cache.entries()) {
      const type = key.split(':')[0];
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.totalHits += entry.hits;

      if (!stats.oldestEntry || entry.createdAt < stats.oldestEntry) {
        stats.oldestEntry = entry.createdAt;
      }
      if (!stats.newestEntry || entry.createdAt > stats.newestEntry) {
        stats.newestEntry = entry.createdAt;
      }
    }

    return stats;
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Cache configuration by type
const CACHE_TTL = {
  analysis: 5 * 60 * 1000,      // 5 minutes for analysis queries
  competitor: 10 * 60 * 1000,   // 10 minutes for competitor comparisons
  simulation: 3 * 60 * 1000,    // 3 minutes for promotion simulations
  dashboard: 30 * 1000,         // 30 seconds for dashboard data
  default: 5 * 60 * 1000        // 5 minutes default
};

// Singleton cache instance
const cache = new TTLCache(CACHE_TTL.default);

/**
 * Cache wrapper for async functions
 * @param {string} type - Cache type
 * @param {object} params - Request parameters for cache key
 * @param {function} fn - Async function to execute if cache miss
 * @returns {Promise<any>} Cached or fresh result
 */
async function withCache(type, params, fn) {
  const key = cache.generateKey(type, params);

  // Check cache first
  const cached = cache.get(key);
  if (cached !== null) {
    console.log(`[Cache] HIT: ${type} (key: ${key.substring(0, 20)}...)`);
    return { ...cached, _cached: true, _cacheKey: key };
  }

  console.log(`[Cache] MISS: ${type} (key: ${key.substring(0, 20)}...)`);

  // Execute function and cache result
  const result = await fn();

  const ttl = CACHE_TTL[type] || CACHE_TTL.default;
  cache.set(key, result, ttl);

  return { ...result, _cached: false, _cacheKey: key };
}

/**
 * Invalidate cache when actions are applied
 * Called after price changes, approvals, etc.
 */
function invalidateOnAction() {
  console.log('[Cache] Invalidating cache due to action');
  cache.clearByType('analysis');
  cache.clearByType('simulation');
  cache.clearByType('dashboard');
  // Keep competitor cache as it's external data
}

module.exports = {
  cache,
  withCache,
  invalidateOnAction,
  CACHE_TTL
};
