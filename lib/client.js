const url = require('url');
const rs256 = require('jwa')('RS256');
const jwkToPem = require('jwk-to-pem');
const querystring = require('querystring');
const MemoryStore = require('./stores/memory');

/**
 * Default ports for URL schemes.
 */
const SCHEME_PORTS = {
    'http:': '80',
    'https:': '443'
};

/**
 * Get the origin for a URL.
 */
const getOrigin = (str) => {
    const parsed = url.parse(str);
    const { protocol, hostname } = parsed;
    let { port } = parsed;
    if (!SCHEME_PORTS.hasOwnProperty(protocol)) {
        throw Error(`Unsupported URL scheme: ${protocol}`);
    }
    if (port === SCHEME_PORTS[protocol]) {
        port = null;
    }
    return url.format({ protocol, hostname, port });
};

/**
 * Client for a Portier broker.
 */
class PortierClient {
    /**
     * Client constructor parameters.
     * Only `redirectUri` is required.
     * @typedef {object} ClientParams
     * @property {AbstractStore} store
     * @property {string} broker - The broker origin
     * @property {string} redirectUri
     */

    /**
     * @param {ClientParams} params
     */
    constructor(params) {
        this.store = params.store || new MemoryStore();
        this.broker = params.broker || 'https://broker.portier.io';
        this.redirectUri = params.redirectUri;

        this.leeway = 3 * 60 * 1000;  // 3 minutes
        this.clientId = getOrigin(this.redirectUri);
    }

    /**
     * Destroy the client.
     * Simply calls `destroy` on the store.
     */
    destroy() {
        this.store.destroy();
    }

    /**
     * Callback signature of `authenticate`.
     * @param {Error} err
     * @param {string} authUrl - URL to redirect the user to.
     */

    /**
     * Start authentication of an email address.
     * @param {string} email
     * @param {AuthenticateCallback} cb
     */
    authenticate(email, cb) {
        this.store.createNonce(email, (err, nonce) => {
            if (err) {
                cb(err);
                return;
            }

            const params = querystring.stringify({
                login_hint: email,
                scope: 'openid email',
                nonce: nonce,
                response_type: 'id_token',
                response_mode: 'form_post',
                client_id: this.clientId,
                redirect_uri: this.redirectUri
            });
            cb(null, `${this.broker}/auth?${params}`);
        });
    }

    /**
     * Callback signature of `verify`.
     * @param {Error} err
     * @param {string} email - The verified email address
     */

    /**
     * Verify a token received on our `redirect_uri`.
     * @param {string} token
     * @param {VerifyCallback} cb
     */
    verify(token, cb) {
        const discoveryUrl = this.broker + '/.well-known/openid-configuration';
        this.store.fetchCached('discovery', discoveryUrl, (err, discovery) => {
            if (err) {
                cb(err);
                return;
            }

            this.store.fetchCached('keys', discovery.jwks_uri, (err, keys) => {
                if (err) {
                    cb(err);
                    return;
                }

                let payload;
                try {
                    payload = verifyToken(
                        token, keys, this.broker, this.clientId, this.leeway
                    );
                }
                catch (err) {
                    cb(err);
                    return;
                }

                this.store.consumeNonce(payload.nonce, payload.sub, (err) => {
                    if (err) {
                        cb(err);
                        return;
                    }

                    cb(null, payload.sub);
                });
            });
        });
    }
}

const verifyToken = (token, keysDoc, iss, aud, leeway) => {
    // Split the token.
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw Error('Invalid token');
    }
    const [rawHeader, rawPayload, signature] = parts;

    // Decode the header.
    let header;
    try {
        header = JSON.parse(Buffer.from(rawHeader, 'base64').toString());
        if (!header || typeof header !== 'object') {
            throw 'not an object';
        }
    }
    catch (err) {
        throw Error(`Invalid token header: ${err.message || err}`);
    }

    // Verify the algorithm used.
    if (header.alg !== 'RS256') {
        throw Error('Invalid token signing algorithm');
    }

    // Get the public key.
    if (!Array.isArray(keysDoc.keys)) {
        throw Error('Keys document incorrectly formatted');
    }
    const key = keysDoc.keys.find((key) => {
        return key && key.alg === 'RS256' && key.kid === header.kid;
    });
    if (!key) {
        throw Error('Cannot find the public key used to sign the token');
    }

    // Verify the signature.
    const signingInput = `${rawHeader}.${rawPayload}`;
    if (!rs256.verify(signingInput, signature, jwkToPem(key))) {
        throw Error('Token signature did not validate');
    }

    // Decode the payload.
    let payload;
    try {
        payload = JSON.parse(Buffer.from(rawPayload, 'base64').toString());
        if (!payload || typeof payload !== 'object') {
            throw 'not an object';
        }
    }
    catch (err) {
        throw Error(`Invalid token payload: ${err.message || err}`);
    }

    // Verify claims made in the token.
    const now = Date.now();
    if (payload.iss !== iss) {
        throw Error('Invalid token "iss" claim');
    }
    if (typeof payload.sub !== 'string') {
        throw Error('Invalid token "sub" claim');
    }
    if (payload.aud !== aud) {
        throw Error('Invalid token "aud" claim');
    }
    if (typeof payload.exp === 'number') {
        if (now > (payload.exp * 1000 + leeway)) {
            throw Error('Token has expired');
        }
    }
    if (typeof payload.nbf === 'number') {
        if (now < (payload.nbf * 1000 - leeway)) {
            throw Error('Token validity is in the future');
        }
    }
    if (typeof payload.iat === 'number') {
        if (now < (payload.iat * 1000 - leeway)) {
            throw Error('Token issue time is in the future');
        }
    }
    if (typeof payload.nonce !== 'string') {
        throw Error('Invalid token "nonce" claim');
    }

    return payload;
};

module.exports = PortierClient;
