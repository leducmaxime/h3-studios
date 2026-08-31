const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export interface PushEncryptionOverrides {
  salt?: Uint8Array;
  serverPrivateKeyD?: string;
  serverPublicKey?: string;
}

export interface EncryptedPushPayload {
  body: Uint8Array;
  salt: Uint8Array;
  saltBase64Url: string;
  keyid: string;
}

export interface VapidHeadersOptions {
  jwt: string;
  vapidPublicKey: string;
  ttl: number | string;
  urgency: string;
  topic?: string;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** Encodage base64url sans recours à Buffer, y compris pour les gros messages. */
export function encodeBase64Url(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset];
    const second = offset + 1 < bytes.length ? bytes[offset + 1] : 0;
    const third = offset + 2 < bytes.length ? bytes[offset + 2] : 0;
    const hasSecond = offset + 1 < bytes.length;
    const hasThird = offset + 2 < bytes.length;

    chunks.push(
      BASE64URL_ALPHABET[first >> 2],
      BASE64URL_ALPHABET[((first & 0x03) << 4) | (second >> 4)],
      hasSecond ? BASE64URL_ALPHABET[((second & 0x0f) << 2) | (third >> 6)] : "",
      hasThird ? BASE64URL_ALPHABET[third & 0x3f] : "",
    );
  }
  return chunks.join("");
}

function base64Value(character: string): number {
  return BASE64URL_ALPHABET.indexOf(character);
}

/** Décodage tolérant au padding, sans spread operator susceptible de saturer la pile. */
export function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(value)) {
    throw new Error("Invalid base64url value");
  }

  const padding = value.indexOf("=");
  const encoded = padding === -1 ? value : value.slice(0, padding);
  const paddingLength = padding === -1 ? 0 : value.length - padding;
  if (padding !== -1 && encoded.length % 4 !== (paddingLength === 2 ? 2 : 3)) {
    throw new Error("Invalid base64url padding");
  }
  if (encoded.length % 4 === 1) {
    throw new Error("Invalid base64url length");
  }

  const result = new Uint8Array(Math.floor(encoded.length * 6 / 8));
  let outputOffset = 0;
  for (let offset = 0; offset < encoded.length; offset += 4) {
    const remaining = encoded.length - offset;
    const a = base64Value(encoded[offset]);
    const b = base64Value(encoded[offset + 1]);
    const c = remaining > 2 ? base64Value(encoded[offset + 2]) : 0;
    const d = remaining > 3 ? base64Value(encoded[offset + 3]) : 0;
    if (a < 0 || b < 0 || (remaining > 2 && c < 0) || (remaining > 3 && d < 0)) {
      throw new Error("Invalid base64url value");
    }
    result[outputOffset++] = (a << 2) | (b >> 4);
    if (remaining > 2) result[outputOffset++] = ((b & 0x0f) << 4) | (c >> 2);
    if (remaining > 3) result[outputOffset++] = ((c & 0x03) << 6) | d;
  }
  return result;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, toArrayBuffer(data)));
}

function assertPublicKey(value: Uint8Array, name: string): void {
  if (value.length !== 65 || value[0] !== 0x04) {
    throw new Error(`${name} must be a 65-byte uncompressed P-256 public key`);
  }
}

function assertPrivateKey(value: Uint8Array, name: string): void {
  if (value.length !== 32) throw new Error(`${name} must be a 32-byte P-256 private key`);
}

function publicJwk(publicKey: Uint8Array): Pick<JsonWebKey, "kty" | "crv" | "x" | "y"> {
  return {
    kty: "EC",
    crv: "P-256",
    x: encodeBase64Url(publicKey.slice(1, 33)),
    y: encodeBase64Url(publicKey.slice(33, 65)),
  };
}

async function importEcdhPrivateKey(privateD: Uint8Array, serverPublicKey: Uint8Array): Promise<CryptoKey> {
  const jwk: JsonWebKey = {
    ...publicJwk(serverPublicKey),
    d: encodeBase64Url(privateD),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
}

async function createServerEcdhKeyPair(): Promise<{ privateKey: CryptoKey; publicKey: Uint8Array }> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits", "deriveKey"],
  ) as CryptoKeyPair;
  return {
    privateKey: pair.privateKey,
    publicKey: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)),
  };
}

/**
 * Chiffre un payload selon RFC 8291 §3.4 et RFC 8188 (enregistrement final 0x02).
 * Le sel et la paire éphémère sont volontairement régénérés à chaque appel.
 */
export async function encryptWebPushPayload(
  p256dh: string,
  auth: string,
  plaintext: Uint8Array | string,
  testOverrides: PushEncryptionOverrides = {},
): Promise<EncryptedPushPayload> {
  const uaPublicKey = decodeBase64Url(p256dh);
  assertPublicKey(uaPublicKey, "p256dh");
  const authSecret = decodeBase64Url(auth);
  if (authSecret.length !== 16) throw new Error("auth must be a 16-byte secret");

  const message = typeof plaintext === "string" ? utf8(plaintext) : new Uint8Array(plaintext);
  if (message.length + 1 + 16 + 86 > 4096) {
    throw new Error("plaintext is too large for the 4096-byte Web Push record limit");
  }

  const uaKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(uaPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  let serverPrivateKey: CryptoKey;
  let serverPublicKey: Uint8Array;
  const hasPrivateOverride = testOverrides.serverPrivateKeyD !== undefined;
  const hasPublicOverride = testOverrides.serverPublicKey !== undefined;
  if (hasPrivateOverride !== hasPublicOverride) {
    throw new Error("serverPrivateKeyD and serverPublicKey must be supplied together");
  }
  if (hasPrivateOverride && hasPublicOverride) {
    const privateD = decodeBase64Url(testOverrides.serverPrivateKeyD!);
    serverPublicKey = decodeBase64Url(testOverrides.serverPublicKey!);
    assertPrivateKey(privateD, "serverPrivateKeyD");
    assertPublicKey(serverPublicKey, "serverPublicKey");
    serverPrivateKey = await importEcdhPrivateKey(privateD, serverPublicKey);
  } else {
    const pair = await createServerEcdhKeyPair();
    serverPrivateKey = pair.privateKey;
    serverPublicKey = pair.publicKey;
    assertPublicKey(serverPublicKey, "serverPublicKey");
  }

  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaKey },
    serverPrivateKey,
    256,
  ));
  const keyInfo = concatBytes(utf8("WebPush: info"), new Uint8Array([0]), uaPublicKey, serverPublicKey);
  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  const ikm = await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([1])));

  const salt = testOverrides.salt ? new Uint8Array(testOverrides.salt) : crypto.getRandomValues(new Uint8Array(16));
  if (salt.length !== 16) throw new Error("salt must be 16 bytes");
  const prk = await hmacSha256(salt, ikm);
  const cek = (await hmacSha256(prk, concatBytes(utf8("Content-Encoding: aes128gcm"), new Uint8Array([0, 1])))).slice(0, 16);
  const nonce = (await hmacSha256(prk, concatBytes(utf8("Content-Encoding: nonce"), new Uint8Array([0, 1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey("raw", toArrayBuffer(cek), "AES-GCM", false, ["encrypt"]);
  const record = concatBytes(message, new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce), tagLength: 128 },
    aesKey,
    toArrayBuffer(record),
  ));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const body = concatBytes(salt, rs, new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
  return {
    body,
    salt,
    saltBase64Url: encodeBase64Url(salt),
    keyid: encodeBase64Url(serverPublicKey),
  };
}

// Alias explicites pour garder l'appelant indépendant du nom historique retenu ici.
export const encryptPushPayload = encryptWebPushPayload;
export const encryptPayload = encryptWebPushPayload;

export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!jwk.d || !jwk.x || !jwk.y) throw new Error("Unable to export VAPID key pair");
  const publicKey = concatBytes(new Uint8Array([0x04]), decodeBase64Url(jwk.x), decodeBase64Url(jwk.y));
  assertPublicKey(publicKey, "VAPID public key");
  const privateKey = decodeBase64Url(jwk.d);
  assertPrivateKey(privateKey, "VAPID private key");
  return { publicKey: encodeBase64Url(publicKey), privateKey: encodeBase64Url(privateKey) };
}

export async function createVapidJwt(
  endpoint: string,
  subject: string,
  publicKeyB64u: string,
  privateKeyDB64u: string,
): Promise<string> {
  const publicKey = decodeBase64Url(publicKeyB64u);
  const privateD = decodeBase64Url(privateKeyDB64u);
  assertPublicKey(publicKey, "VAPID public key");
  assertPrivateKey(privateD, "VAPID private key");
  const jwk: JsonWebKey = { ...publicJwk(publicKey), d: encodeBase64Url(privateD), ext: true };
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = encodeBase64Url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = encodeBase64Url(utf8(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));
  const signingInput = utf8(`${header}.${claims}`);
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    toArrayBuffer(signingInput),
  ));
  if (signature.length !== 64) throw new Error("Web Crypto returned a non-P1363 ES256 signature");
  return `${header}.${claims}.${encodeBase64Url(signature)}`;
}

export function buildPushHeaders(options: VapidHeadersOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `vapid t=${options.jwt}, k=${options.vapidPublicKey}`,
    TTL: String(options.ttl),
    Urgency: options.urgency,
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
  };
  if (options.topic !== undefined) headers.Topic = options.topic;
  return headers;
}
