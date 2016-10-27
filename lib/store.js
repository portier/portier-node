const crypto = require('crypto');
const request = require('request');

/**
 * Abstract base class for store implementations.
 * @property {number} nonceTtl - Lifespan of a nonce.
 * @property {number} requestTimeout - `fetch` timeout.
 * @property {number} cacheMinAge - `fetchCached` minimum cache time.
 */
class AbstractStore {
    constructor() {
        this.nonceTtl = 15 * 60 * 1000;  // 15 minutes
        this.requestTimeout = 10 * 1000; // 10 seconds
        this.cacheMinAge = 60 * 60 * 1000;  // 1 hour
    }

    /**
     * Callback signature of `fetchCached`.
     * @callback FetchCachedCallback
     * @param {Error} err
     * @param {object} data
     */

    /**
     * Fetch JSON from cache or using HTTP GET.
     * @abstract
     * @param {string} cacheId
     * @param {string} url
     * @param {FetchCachedCallback} cb
     */
    fetchCached() { throw Error('Not implemented'); }

    /**
     * Callback signature of `createNonce`.
     * @callback CreateNonceCallback
     * @param {Error} err
     * @param {string} nonce
     */

    /**
     * Generate and store a nonce.
     * @abstract
     * @param {string} email - Email address to associate with the nonce.
     * @param {CreateNonceCallback} cb
     */
    createNonce() { throw Error('Not implemented'); }

    /**
     * Callback signature of `consumeNonce`.
     * @callback ConsumeNonceCallback
     * @param {Error} err
     */

    /**
     * Consume a nonce, and check if it's valid for the given email address.
     * @abstract
     * @param {string} nonce
     * @param {string} email
     * @param {ConsumeNonceCallback} cb
     */
    consumeNonce() { throw Error('Not implemented'); }

    /**
     * Destroy the store.
     *
     * The default implementation does nothing.
     */
    destroy() {}

    /**
     * Generate a new nonce.
     * @param {string} email - Optional email address context.
     * @return {string}
     */
    generateNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Result type of `fetch`.
     * @typedef {object} FetchResult
     * @property {number} expires - Expiry time of result.
     * @property {object} data - Response body.

    /**
     * Callback signature of `fetch`.
     * @callback FetchCallback
     * @param {Error} err
     * @param {FetchResult} result

    /**
     * Fetch a URL using HTTP GET.
     * @param {string} url
     * @param {FetchCallback} cb
     */
    fetch(url, cb) {
        request({
            method: 'GET',
            url,
            strictSSL: true,
            json: true,
            timeout: this.requestTimeout
        }, (err, res) => {
            if (err) {
                cb(err);
                return;
            }

            if (res.statusCode !== 200) {
                cb(Error(`Unexpected status code ${res.statusCode}`));
                return;
            }

            const data = res.body;
            if (!data || typeof data !== 'object') {
                cb(Error(`Invalid response body`));
                return;
            }

            let maxAge = 0;
            const cc = res.headers['cache-control'];
            if (cc) {
                const match = /max-age\s*=\s*(\d+)/.exec(cc);
                if (match) {
                    maxAge = parseInt(match[1], 10) * 1000;
                }
            }
            const expires = Date.now() + Math.min(this.cacheMinAge, maxAge);

            cb(null, { expires, data });
        });
    }
}

module.exports = AbstractStore;
