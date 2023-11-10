import AbstractStore from "../store.js";

/** An in-memory store implementation. */
export default class MemoryStore extends AbstractStore {
  private data: { [key: string]: { ex: number; data: any } };
  private interval?: NodeJS.Timeout;

  constructor() {
    super();

    this.data = Object.create(null);
    this.interval = setInterval(
      () => this.gc(),
      60 * 1000, // 1 minute
    );
  }

  /** Fetch JSON from cache or using HTTP GET. */
  async fetchCached(cacheId: string, url: string): Promise<any | undefined> {
    // Do garbage collection now, so we never use expired store items.
    this.gc();

    // Create a store key for a cache item.
    const key = `cache:${cacheId}`;

    // Check if the item exists.
    const item = this.data[key];
    if (item) {
      return item.data;
    }

    // Fetch the URL.
    const { ttl, data } = await this.fetch(url);

    // Cache the result.
    this.data[key] = { ex: Date.now() + ttl, data };

    // Return the result.
    return data;
  }

  /** Generate and store a nonce. */
  async createNonce(email: string): Promise<string> {
    const nonce = this.generateNonce(email);

    // Create a store key for a nonce item.
    const key = `nonce:${nonce}`;

    // Store the nonce.
    this.data[key] = { ex: Date.now() + this.nonceTtl, data: email };

    // Return the nonce.
    return nonce;
  }

  /** Consume a nonce, and check if it's valid for the given email address. */
  async consumeNonce(nonce: string, email: string): Promise<void> {
    // Do garbage collection now, so we never use expired store items.
    this.gc();

    // Create a store key for a nonce item.
    const key = `nonce:${nonce}`;

    // Take the item from the store.
    const item = this.data[key];
    delete this.data[key];

    // Check if the nonce was valid.
    if (!item || item.data !== email) {
      throw Error("Invalid or expired nonce");
    }
  }

  /** Destroy the store. */
  destroy(): void {
    if (this.interval !== undefined) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  /** Remove expired items from the store */
  private gc(): void {
    const now = Date.now();
    for (const key of Object.keys(this.data)) {
      if (this.data[key].ex <= now) {
        delete this.data[key];
      }
    }
  }
}
