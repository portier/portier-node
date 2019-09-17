import AbstractStore from "../store";
import { RedisClient } from "redis";

/**
 * Store implementation using Redis.
 *
 * The store takes a `RedisClient`, but does NOT take ownership of that
 * client. If you need to clean up, you must close the client yourself.
 */
export default class RedisStore extends AbstractStore {
  readonly client: RedisClient;

  constructor(client: RedisClient) {
    super();

    this.client = client;
  }

  /** Fetch JSON from cache or using HTTP GET. */
  async fetchCached(cacheId: string, url: string): Promise<any | undefined> {
    // Create a store key for a cache item.
    const key = `cache:${cacheId}`;

    // Check if the item exists.
    const item: string = await new Promise((resolve, reject) => {
      this.client.get(key, (err, data) => {
        err ? reject(err) : resolve(data);
      });
    });
    if (item) {
      return JSON.parse(item);
    }

    // Fetch the URL.
    const { ttl, data } = await this.fetch(url);

    // Cache the result.
    await new Promise((resolve, reject) => {
      const json = JSON.stringify(data);
      this.client.psetex(key, ttl, json, err => {
        err ? reject(err) : resolve();
      });
    });

    // Return the result.
    return data;
  }

  /** Generate and store a nonce. */
  async createNonce(email: string): Promise<string> {
    const nonce = this.generateNonce(email);

    // Create a store key for a nonce item.
    const key = `nonce:${nonce}`;

    // Store the nonce.
    await new Promise((resolve, reject) => {
      this.client.psetex(key, this.nonceTtl, email, err => {
        err ? reject(err) : resolve();
      });
    });

    // Return the nonce.
    return nonce;
  }

  /** Consume a nonce, and check if it's valid for the given email address. */
  async consumeNonce(nonce: string, email: string): Promise<void> {
    // Create a store key for a nonce item.
    const key = `nonce:${nonce}`;

    // Take the item from the store.
    const item = await new Promise((resolve, reject) => {
      this.client
        .multi()
        .get(key)
        .del(key)
        .exec((err, replies) => {
          err ? reject(err) : resolve(replies[0]);
        });
    });

    if (item !== email) {
      throw Error("Invalid or expired nonce");
    }
  }
}
