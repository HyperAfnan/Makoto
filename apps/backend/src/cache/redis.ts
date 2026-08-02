import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

type Client = RedisClientType;
let client: Client | undefined;
let unavailable = false;

async function getClient() {
  if (!env.REDIS_URL || unavailable) return undefined;
  if (!client) {
    client = createClient({ socket: { connectTimeout: 1000, reconnectStrategy: false }, url: env.REDIS_URL }) as Client;
    client.on("error", (error) => logger.warn("redis error", { error: error.message }));
  }
  if (!client.isOpen) {
    try {
      await client.connect();
    } catch (error) {
      unavailable = true;
      logger.warn("redis unavailable; continuing without Redis", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }
  return client;
}

export async function redisGet(key: string) {
  const connection = await getClient();
  if (!connection) return null;
  try {
    return await connection.get(key);
  } catch (error) {
    logger.warn("redis get failed", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSeconds: number) {
  const connection = await getClient();
  if (!connection) return false;
  try {
    await connection.set(key, value, { EX: ttlSeconds });
    return true;
  } catch (error) {
    logger.warn("redis set failed", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function redisIncrement(key: string, ttlSeconds: number) {
  const connection = await getClient();
  if (!connection) return null;
  try {
    const count = await connection.incr(key);
    if (count === 1) await connection.expire(key, ttlSeconds);
    return count;
  } catch (error) {
    logger.warn("redis increment failed", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
