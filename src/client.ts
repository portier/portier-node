import url from "node:url";
import jwa from "jwa";
import jwkToPem from "jwk-to-pem";
import querystring from "node:querystring";
import AbstractStore from "./store.js";
import MemoryStore from "./stores/memory.js";

const rs256 = jwa("RS256");

/**
 * Get the origin for a URL.
 */
const getOrigin = (input: string): string => {
  const parsed = url.parse(input);
  const { protocol, hostname } = parsed;
  let { port } = parsed;

  if (protocol === "http:") {
    if (port === "80") {
      port = null;
    }
  } else if (protocol === "https:") {
    if (port === "443") {
      port = null;
    }
  } else {
    throw Error(`Unsupported URL scheme: ${protocol || ""}`);
  }

  return url.format({ protocol, hostname, port });
};

/**
 * Client for a Portier broker.
 */
export default class PortierClient {
  /** The store used by this client. */
  store: AbstractStore;
  /** The broker origin. */
  broker: string;
  /** How a user agent will send credentials to `redirectUri`. */
  responseMode: "form_post" | "fragment";

  /** Leeway to allow in clock drift between us and the broker. */
  leeway: number = 3 * 60 * 1000; // 3 minutes

  private _redirectUri: string = "";
  private _clientId: string = "";

  constructor(params: {
    store?: AbstractStore;
    broker?: string;
    redirectUri: string;
    responseMode?: "form_post" | "fragment";
  }) {
    this.store = params.store || new MemoryStore();
    this.broker = params.broker || "https://broker.portier.io";
    this.redirectUri = params.redirectUri;
    this.responseMode = params.responseMode || "form_post";
  }

  /**
   * Destroy the client.
   *
   * Simply calls `destroy` on the store.
   */
  destroy(): void {
    this.store.destroy();
  }

  /** The URI a user agent will return to after authentication. */
  get redirectUri(): string {
    return this._redirectUri;
  }

  set redirectUri(uri: string) {
    this._redirectUri = uri;
    this._clientId = getOrigin(this.redirectUri);
  }

  /**
   * Start authentication of an email address.
   *
   * Returns a URL to redirect the user agent to.
   *
   * This method rethrows any failures from the store.
   */
  async authenticate(email: string, state?: string): Promise<string> {
    const discovery = await this.fetchDiscovery();
    const nonce = await this.store.createNonce(email);

    const params = querystring.stringify({
      login_hint: email,
      scope: "openid email",
      nonce,
      response_type: "id_token",
      response_mode: this.responseMode,
      client_id: this._clientId,
      redirect_uri: this._redirectUri,
      state,
    });
    return `${discovery.authorization_endpoint}?${params}`;
  }

  /**
   * Verify a token received on our `redirectUri`.
   *
   * On success, returns the verified email address.
   *
   * If the token is invalid, this method throws. This method also rethrows any
   * failures from the store.
   */
  async verify(token: string): Promise<string> {
    const discovery = await this.fetchDiscovery();
    const keys = await this.store.fetchCached("keys", discovery.jwks_uri);

    const payload = verifyToken(
      token,
      keys,
      this.broker,
      this._clientId,
      this.leeway,
    );

    await this.store.consumeNonce(
      payload.nonce,
      payload.email_original || payload.email,
    );

    return payload.email;
  }

  private async fetchDiscovery(): Promise<any> {
    const discoveryUrl = `${this.broker}/.well-known/openid-configuration`;
    return this.store.fetchCached("discovery", discoveryUrl);
  }
}

const verifyToken = (
  token: string,
  keysDoc: any,
  iss: string,
  aud: string,
  leeway: number,
): any => {
  // Split the token.
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw Error("Invalid token");
  }
  const [rawHeader, rawPayload, signature] = parts;

  // Decode the header.
  let header: any;
  try {
    header = JSON.parse(Buffer.from(rawHeader, "base64").toString());
    if (!header || typeof header !== "object") {
      throw Error("not an object");
    }
  } catch (err: any) {
    throw Error(`Invalid token header: ${err.message || err}`);
  }

  // Verify the algorithm used.
  if (header.alg !== "RS256") {
    throw Error("Invalid token signing algorithm");
  }

  // Get the public key.
  if (!Array.isArray(keysDoc.keys)) {
    throw Error("Keys document incorrectly formatted");
  }
  const key = keysDoc.keys.find((key: any) => {
    return key && key.alg === "RS256" && key.kid === header.kid;
  });
  if (!key) {
    throw Error("Cannot find the public key used to sign the token");
  }

  // Verify the signature.
  const signingInput = `${rawHeader}.${rawPayload}`;
  if (!rs256.verify(signingInput, signature, jwkToPem(key))) {
    throw Error("Token signature did not validate");
  }

  // Decode the payload.
  let payload;
  try {
    payload = JSON.parse(Buffer.from(rawPayload, "base64").toString());
    if (!payload || typeof payload !== "object") {
      throw Error("not an object");
    }
  } catch (err: any) {
    throw Error(`Invalid token payload: ${err.message || err}`);
  }

  // Verify claims made in the token.
  const now = Date.now();
  if (payload.iss !== iss) {
    throw Error('Invalid token "iss" claim');
  }
  if (payload.aud !== aud) {
    throw Error('Invalid token "aud" claim');
  }
  if (typeof payload.exp === "number") {
    if (now > payload.exp * 1000 + leeway) {
      throw Error("Token has expired");
    }
  }
  if (typeof payload.nbf === "number") {
    if (now < payload.nbf * 1000 - leeway) {
      throw Error("Token validity is in the future");
    }
  }
  if (typeof payload.iat === "number") {
    if (now < payload.iat * 1000 - leeway) {
      throw Error("Token issue time is in the future");
    }
  }
  if (typeof payload.nonce !== "string") {
    throw Error('Invalid token "nonce" claim');
  }

  return payload;
};
