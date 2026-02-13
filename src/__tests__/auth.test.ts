import { describe, it, expect } from "vitest";

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(password: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveKey(password, salt.buffer);
  return `${arrayBufferToBase64(salt.buffer)}:${arrayBufferToBase64(hash)}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltB64, hashB64] = storedHash.split(":");
  if (!saltB64 || !hashB64) {
    return false;
  }

  const salt = base64ToArrayBuffer(saltB64);
  const expectedHash = base64ToArrayBuffer(hashB64);
  const actualHash = await deriveKey(password, salt);

  const expected = new Uint8Array(expectedHash);
  const actual = new Uint8Array(actualHash);

  if (expected.length !== actual.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected[i] ^ actual[i];
  }

  return result === 0;
}

describe("hashPassword", () => {
  it("should produce a hash in format base64(salt):base64(hash)", async () => {
    const password = "testPassword123";
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).toContain(":");
    
    const parts = hash.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("should produce different hashes for same password (random salt)", async () => {
    const password = "samePassword";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    expect(hash1).not.toBe(hash2);
  });

  it("should produce hash of expected length", async () => {
    const password = "password";
    const hash = await hashPassword(password);
    
    const [, hashPart] = hash.split(":");
    const decoded = atob(hashPart);
    expect(decoded.length).toBe(32);
  });
});

describe("verifyPassword", () => {
  it("should return true for correct password", async () => {
    const password = "correctPassword";
    const hash = await hashPassword(password);
    
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it("should return false for incorrect password", async () => {
    const password = "correctPassword";
    const hash = await hashPassword(password);
    
    const result = await verifyPassword("wrongPassword", hash);
    expect(result).toBe(false);
  });

  it("should return false for malformed hash", async () => {
    const result = await verifyPassword("password", "not-a-valid-hash");
    expect(result).toBe(false);
  });

  it("should return false for hash missing parts", async () => {
    const result = await verifyPassword("password", "onlyOnePart");
    expect(result).toBe(false);
  });

  it("should return false for empty hash", async () => {
    const result = await verifyPassword("password", "");
    expect(result).toBe(false);
  });
});
