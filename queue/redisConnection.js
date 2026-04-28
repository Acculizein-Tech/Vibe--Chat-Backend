import IORedis from "ioredis";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const maxRetryAttempts = Number(process.env.REDIS_MAX_RETRY_ATTEMPTS || 0);
const connectTimeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 8000);
const reconnectDelayMs = Number(process.env.REDIS_RECONNECT_DELAY_MS || 1500);

let lastRedisErrorLogAt = 0;

export const redisConnection = new IORedis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: connectTimeoutMs,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (maxRetryAttempts > 0 && times >= maxRetryAttempts) {
      return null;
    }
    return reconnectDelayMs;
  },
});

redisConnection.on("error", (error) => {
  const now = Date.now();
  // Prevent console flood if Redis is down.
  if (now - lastRedisErrorLogAt < 5000) return;
  lastRedisErrorLogAt = now;
  console.error("Redis connection error:", error?.message || error);
});

export const ensureRedisConnection = async () => {
  try {
    if (redisConnection.status !== "ready") {
      await redisConnection.connect();
    }
    await redisConnection.ping();
    return true;
  } catch (_err) {
    return false;
  }
};
