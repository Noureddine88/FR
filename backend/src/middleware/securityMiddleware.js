const hits = new Map();
const MAX_KEYS = 50_000;

export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

export const rateLimit =
  (windowMs = 15 * 60 * 1000, max = 500) =>
  (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = hits.get(key);
    if (!record) {
      // Evict expired keys to avoid unbounded growth
      if (hits.size >= MAX_KEYS) {
        for (const [k, v] of hits) {
          if (v.resetAt < now) hits.delete(k);
          if (hits.size < MAX_KEYS) break;
        }
        // Hard-evict if still full
        while (hits.size >= MAX_KEYS) {
          const firstKey = hits.keys().next().value;
          if (!firstKey) break;
          hits.delete(firstKey);
        }
      }
      record = { count: 0, resetAt: now + windowMs };
    }

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }

    record.count += 1;
    hits.set(key, record);

    if (record.count > max) return res.status(429).json({ message: 'Trop de requêtes. Veuillez patienter avant de réessayer.' });
    return next();
  };
