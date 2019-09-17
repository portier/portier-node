// TypeScript declarations for dependencies that don't have any.

declare module "jwk-to-pem" {
  function jwkToPem(jwk: any, opts?: { private?: boolean }): string;

  export = jwkToPem;
}

declare module "jwa" {
  class Jwa {
    verify(input: string, signature: string, publicKey: string): boolean;
  }

  function createJwa(alg: string): Jwa;

  export = createJwa;
}
