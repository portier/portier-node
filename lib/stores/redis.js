const AbstractStore = require('../store');

/**
 * Store implementation using Redis.
 *
 * The store takes a {redis.RedisClient}, but does NOT take ownership of that
 * client. If you need to clean up, you must close the client yourself.
 */
class RedisStore extends AbstractStore {
    /**
     * @constructor
     * @param {redis.RedisClient} client
     */
    constructor(client) {
        super();

        this.client = client;
    }

    fetchCached(cacheId, url, cb) {
        const key = `cache:${cacheId}`;
        this.client.get(key, (err, data) => {
            if (err) {
                cb(err);
                return;
            }

            if (data) {
                try {
                    data = JSON.parse(data);
                }
                catch (err) {
                    cb(err);
                    return;
                }

                cb(null, data);
                return;
            }

            this.fetch(url, (err, { ttl, data }) => {
                if (err) {
                    cb(err);
                    return;
                }

                const json = JSON.stringify(data);
                this.client.psetex(key, ttl, json, (err) => {
                    if (err) {
                        cb(err);
                        return;
                    }

                    cb(null, data);
                });
            });
        });
    }

    createNonce(email, cb) {
        const nonce = this.generateNonce(email);
        const key = `nonce:${nonce}`;
        this.client.psetex(key, this.nonceTtl, email, (err) => {
            cb(err, nonce);
        });
    }

    consumeNonce(nonce, email, cb) {
        const key = `nonce:${nonce}`;
        this.client.multi().get(key).del(key).exec((err, replies) => {
            if (!err && replies[0] !== email) {
                err = Error('Invalid or expired nonce');
            }
            cb(err);
        });
    }
}

module.exports = RedisStore;
