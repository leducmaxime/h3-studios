import { describe, expect, it } from "vitest";
import {
  buildPushHeaders,
  createVapidJwt,
  decodeBase64Url,
  encodeBase64Url,
  encryptWebPushPayload,
  generateVapidKeys,
} from "../lib/push-crypto";

const auth = "BTBZMqHH6r4Tts7J_aSIgg";
const receiverPrivate = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94";
const receiverPublic = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const senderPrivate = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const senderPublic = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const salt = "DGv6ra1nlYgDCS1FRnbzlw";
const expectedBody = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";
const plaintext = "When I grow up, I want to be a watermelon";

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function hmac(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", asArrayBuffer(keyBytes), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, asArrayBuffer(data)));
}

async function expectedIntermediates(): Promise<Record<string, string>> {
  const ua = decodeBase64Url(receiverPublic);
  const sender = decodeBase64Url(senderPublic);
  const receiverD = decodeBase64Url(receiverPrivate);
  const receiverJwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: encodeBase64Url(receiverD),
    x: encodeBase64Url(ua.slice(1, 33)),
    y: encodeBase64Url(ua.slice(33, 65)),
    ext: true,
  };
  const receiverKey = await crypto.subtle.importKey("jwk", receiverJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const senderKey = await crypto.subtle.importKey("raw", asArrayBuffer(sender), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: senderKey }, receiverKey, 256));
  const keyInfo = concatenate(new TextEncoder().encode("WebPush: info"), new Uint8Array([0]), ua, sender);
  const prkKey = await hmac(decodeBase64Url(auth), ecdh);
  const ikm = await hmac(prkKey, concatenate(keyInfo, new Uint8Array([1])));
  const prk = await hmac(decodeBase64Url(salt), ikm);
  const cek = (await hmac(prk, concatenate(new TextEncoder().encode("Content-Encoding: aes128gcm"), new Uint8Array([0, 1])))).slice(0, 16);
  const nonce = (await hmac(prk, concatenate(new TextEncoder().encode("Content-Encoding: nonce"), new Uint8Array([0, 1])))).slice(0, 12);
  return {
    ecdh_secret: encodeBase64Url(ecdh),
    PRK_key: encodeBase64Url(prkKey),
    IKM: encodeBase64Url(ikm),
    PRK: encodeBase64Url(prk),
    CEK: encodeBase64Url(cek),
    NONCE: encodeBase64Url(nonce),
  };
}

describe("Web Push cryptography", () => {
  it("reproduces RFC 8291 §5 byte-for-byte and every intermediate", async () => {
    const intermediates = await expectedIntermediates();
    expect(intermediates).toEqual({
      ecdh_secret: "kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs",
      PRK_key: "Snr3JMxaHVDXHWJn5wdC52WjpCtd2EIEGBykDcZW32k",
      IKM: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
      PRK: "09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc",
      CEK: "oIhVW04MRdy2XN9CiKLxTg",
      NONCE: "4h_95klXJ5E_qnoN",
    });

    const encrypted = await encryptWebPushPayload(receiverPublic, auth, plaintext, {
      salt: decodeBase64Url(salt),
      serverPrivateKeyD: senderPrivate,
      serverPublicKey: senderPublic,
    });
    expect(encodeBase64Url(encrypted.body)).toBe(expectedBody);
    expect(encrypted.keyid).toBe(senderPublic);
    expect(encrypted.saltBase64Url).toBe(salt);
  });

  it("generates a fresh salt and keyid for every encryption", async () => {
    const first = await encryptWebPushPayload(receiverPublic, auth, plaintext);
    const second = await encryptWebPushPayload(receiverPublic, auth, plaintext);
    expect(first.saltBase64Url).not.toBe(second.saltBase64Url);
    expect(first.keyid).not.toBe(second.keyid);
  });

  it("round-trips base64url for all tail lengths and large inputs", () => {
    for (const bytes of [new Uint8Array([]), new Uint8Array([1]), new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]), new Uint8Array(100_003).fill(37)]) {
      expect(decodeBase64Url(encodeBase64Url(bytes))).toEqual(bytes);
    }
  });

  it("creates a verifiable RFC 8292 ES256 JWT with an origin-only audience", async () => {
    const vapid = await generateVapidKeys();
    const jwt = await createVapidJwt("https://push.example.test/some/path", "mailto:studio@example.test", vapid.publicKey, vapid.privateKey);
    const [encodedHeader, encodedClaims, encodedSignature] = jwt.split(".");
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedHeader))) as { typ: string; alg: string };
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedClaims))) as { aud: string; exp: number; sub: string };
    const publicKey = await crypto.subtle.importKey("raw", asArrayBuffer(decodeBase64Url(vapid.publicKey)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, asArrayBuffer(decodeBase64Url(encodedSignature)), asArrayBuffer(new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`)));
    expect(valid).toBe(true);
    expect(header).toEqual({ typ: "JWT", alg: "ES256" });
    expect(claims.aud).toBe("https://push.example.test");
    expect(claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 24 * 3600);
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(claims.sub).toBe("mailto:studio@example.test");
  });

  it("builds the RFC 8292 request headers", () => {
    expect(buildPushHeaders({ jwt: "jwt", vapidPublicKey: "key", ttl: 60, urgency: "high", topic: "booking" })).toEqual({
      Authorization: "vapid t=jwt, k=key",
      TTL: "60",
      Urgency: "high",
      Topic: "booking",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
    });
  });

  it("rejects malformed keys, auth secrets, and oversized plaintext", async () => {
    await expect(encryptWebPushPayload(encodeBase64Url(new Uint8Array(64)), auth, plaintext)).rejects.toThrow(/p256dh/i);
    await expect(encryptWebPushPayload(receiverPublic, encodeBase64Url(new Uint8Array(15)), plaintext)).rejects.toThrow(/auth/i);
    await expect(encryptWebPushPayload(receiverPublic, auth, new Uint8Array(3994))).rejects.toThrow(/large|4096/i);
  });
});
