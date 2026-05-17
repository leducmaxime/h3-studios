import { hashPassword, verifyPassword } from "./auth";

export { hashPassword, verifyPassword };

export interface ClientUser {
  id: string;
  email: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  band_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
}

const CLIENT_SESSION_COOKIE = "h3_client_session";
const SESSION_DURATION_HOURS = 2;

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

export async function createClientSession(db: D1Database, userId: string): Promise<string> {
  const id = `cls-${generateId()}`;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  await db
    .prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id, userId, token, expiresAt)
    .run();

  return token;
}

export async function validateClientSession(db: D1Database, token: string): Promise<ClientUser | null> {
  const row = await db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.first_name, u.last_name, u.phone, u.band_name,
              u.address_line1, u.address_line2, u.postal_code, u.city, u.is_blocked
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ?`,
    )
    .bind(token)
    .first<{
      user_id: string;
      expires_at: string;
      id: string;
      email: string | null;
      name: string;
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      band_name: string | null;
      address_line1: string | null;
      address_line2: string | null;
      postal_code: string | null;
      city: string | null;
      is_blocked: number;
    }>();

  if (!row) return null;

  const expiresAt = new Date(row.expires_at + "Z");
  if (expiresAt < new Date()) {
    await deleteClientSession(db, token);
    return null;
  }

  if (row.is_blocked) {
    await deleteClientSession(db, token);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    band_name: row.band_name,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    postal_code: row.postal_code,
    city: row.city,
  };
}

export async function deleteClientSession(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

export function buildClientSessionCookie(token: string, maxAgeHours: number = SESSION_DURATION_HOURS): string {
  const maxAge = maxAgeHours * 60 * 60;
  return `${CLIENT_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearClientSessionCookie(): string {
  return `${CLIENT_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function getClientSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split("=");
    if (name === CLIENT_SESSION_COOKIE) {
      return valueParts.join("=");
    }
  }

  return null;
}

export async function requireClientAuth(request: Request, db: D1Database): Promise<ClientUser> {
  const token = getClientSessionToken(request);
  if (!token) {
    throw new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await validateClientSession(db, token);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Session invalide ou expirée" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return user;
}