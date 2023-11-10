import crypto from "node:crypto";

/** Abstract base class for store implementations. */
export default abstract class AbstractStore {
  /** Lifespan of a nonce. */
  nonceTtl: number = 15 * 60 * 1000; // 15 minutes
  /** `fetch` timeout. */
  requestTimeout: number = 10 * 1000; // 10 seconds
  /** `fetchCached` minimum cache time. */
  cacheMinTtl: number = 60 * 60 * 1000; // 1 hour

  /** Fetch JSON from cache or using HTTP GET. */
  abstract fetchCached(cacheId: string, url: string): Promise<any | undefined>;

  /** Generate and store a nonce. */
  abstract createNonce(email: string): Promise<string>;

  /** Consume a nonce, and check if it's valid for the given email address. */
  abstract consumeNonce(nonce: string, email: string): Promise<void>;

  /** Destroy the store. */
  destroy(): void {}

  /** Generate a new nonce. */
  generateNonce(_email: string): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /** Fetch a URL using HTTP GET. */
  async fetch(url: string): Promise<{ ttl: number; data: any }> {
    const abortCtrl = new AbortController();
    setTimeout(() => abortCtrl.abort("Request timed out"), this.requestTimeout);

    const res = await fetch(url, { signal: abortCtrl.signal });
    if (res.status !== 200) {
      throw Error(`Unexpected status code ${res.status}`);
    }

    const data = await res.json();
    if (typeof data !== "object") {
      throw Error(`Invalid response body`);
    }

    let ttl = 0;
    const cc = res.headers.get("Cache-Control");
    if (cc) {
      const match = /max-age\s*=\s*(\d+)/.exec(cc);
      if (match) {
        ttl = parseInt(match[1], 10) * 1000;
      }
    }
    ttl = Math.max(this.cacheMinTtl, ttl);

    return { ttl, data };
  }
}
