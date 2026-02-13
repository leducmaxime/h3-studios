import { env } from "cloudflare:workers";

// ============================================================================
// Types
// ============================================================================

export type AdminRole = "super-admin" | "operator";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

// ============================================================================
// Password hashing (PBKDF2 via Web Crypto)
// ============================================================================

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

/**
 * Hash a password using PBKDF2 with a random salt.
 * Returns format: `base64(salt):base64(hash)`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveKey(password, salt.buffer);
  return `${arrayBufferToBase64(salt.buffer)}:${arrayBufferToBase64(hash)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltB64, hashB64] = storedHash.split(":");
  if (!saltB64 || !hashB64) {
    return false;
  }

  const salt = base64ToArrayBuffer(saltB64);
  const expectedHash = base64ToArrayBuffer(hashB64);
  const actualHash = await deriveKey(password, salt);

  // Timing-safe comparison
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

// ============================================================================
// Session management (D1)
// ============================================================================

const SESSION_DURATION_DAYS = 7;

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = `ses-${generateId()}`;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  await db
    .prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id, userId, token, expiresAt)
    .run();

  return token;
}

export async function validateSession(db: D1Database, token: string): Promise<AuthUser | null> {
  const row = await db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.is_active
       FROM sessions s
       JOIN admin_users u ON s.user_id = u.id
       WHERE s.token = ?`,
    )
    .bind(token)
    .first<{
      user_id: string;
      expires_at: string;
      id: string;
      email: string;
      name: string;
      role: AdminRole;
      is_active: number;
    }>();

  if (!row) {
    return null;
  }

  const expiresAt = new Date(row.expires_at + "Z");
  if (expiresAt < new Date()) {
    await deleteSession(db, token);
    return null;
  }

  if (!row.is_active) {
    await deleteSession(db, token);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

// ============================================================================
// Auth middleware helpers
// ============================================================================

const SESSION_COOKIE_NAME = "h3_session";

function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split("=");
    if (name === SESSION_COOKIE_NAME) {
      return valueParts.join("=");
    }
  }

  return null;
}

export async function requireAuth(request: Request): Promise<AuthUser> {
  const token = getSessionToken(request);
  if (!token) {
    throw new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await validateSession(env.DB, token);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Session invalide ou expirée" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return user;
}

export function requireRole(user: AuthUser, role: AdminRole): void {
  if (user.role === "super-admin") {
    return;
  }

  if (user.role !== role) {
    throw new Response(JSON.stringify({ error: "Accès interdit" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function buildSessionCookie(token: string, maxAgeDays: number = SESSION_DURATION_DAYS): string {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
