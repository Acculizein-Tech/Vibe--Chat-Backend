const store = new Map();

const nowMs = () => Date.now();

const cleanup = (bucket, windowMs) => {
  const cutoff = nowMs() - windowMs;
  while (bucket.length && bucket[0] <= cutoff) {
    bucket.shift();
  }
};

export const createSimpleRateLimiter = ({ keyPrefix, windowMs, maxRequests }) => {
  const safePrefix = String(keyPrefix || "rate");
  const safeWindow = Number(windowMs || 60_000);
  const safeMax = Number(maxRequests || 30);

  return (req, res, next) => {
    const userId = String(req.user?._id || "").trim();
    const ip =
      String(req.clientIp || req.ip || req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      "unknown";
    const key = `${safePrefix}:${userId || ip}`;

    if (!store.has(key)) {
      store.set(key, []);
    }

    const bucket = store.get(key);
    cleanup(bucket, safeWindow);

    if (bucket.length >= safeMax) {
      return res.status(429).json({
        message: "Too many requests. Please try again shortly.",
      });
    }

    bucket.push(nowMs());
    next();
  };
};
