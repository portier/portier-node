import AbstractStore from "../store";
import type { RedisClientType } from "@redis/client";

/**
 * Store implementation using Redis.
 *
 * The store takes a `RedisClientType`, but does NOT take ownership of that
 * client. If you need to clean up, you must close the client yourself.
 */
export default class RedisStore extends AbstractStore {
  readonly client: RedisClientType;

  constructor(client: RedisClientType) {
    super();

    this.client = client;
  }

  /** Fetch JSON from cache or using HTTP GET. */
  async fetchCached(cacheId: string, url: string): Promise<any | undefined> {
    // Create a store key for a cache item.
    const key = `cache:${cacheId}`;

    // Check if the item exists.
    const item: string | null = await this.client.get(key);
    if (item) {
      return JSON.parse(item);
    }

    // Fetch the URL.
    const { ttl, data } = await this.fetch(url);

    // Cache the result.
    await this.client.pSetEx(key, ttl, JSON.stringify(data));

    // Return the result.
    return data;
  }

  /** Generate and store a nonce. */
  async createNonce(email: string): Promise<string> {
    const nonce = this.generateNonce(email);

    // Create a store key for a nonce item.
    const key = `nonce:${nonce}`;

    // Store the nonce.
    await this.client.pSetEx(key, this.nonceTtl, email);

    // Return the nonce.
    return nonce;
  }

  /** Consume a nonce, and check if it's valid for the given email address. */
  async consumeNonce(nonce: string, email: string): Promise<void> {
    // Create a store key for a nonce item.
    const key = `nonce:${nonce}`;

    // Take the item from the store.
    const [item] = await this.client.multi().get(key).del(key).exec();

    if (item !== email) {
      throw Error("Invalid or expired nonce");
    }
  }
}
