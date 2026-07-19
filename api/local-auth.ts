import * as cookie from "cookie";
import * as jose from "jose";
import { db } from "./json-db/engine";
import { env } from "./lib/env";

const SECRET_KEY = new TextEncoder().encode(env.appSecret || "alpha-erp-local-secret-key-2026");
export const AUTH_COOKIE_NAME = "alpha_auth";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

// Default admin credentials
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin";

type AuthConfig = {
  username?: string;
  password?: string;
};

export interface LocalAuthPayload {
  username: string;
  role: string;
}

export function ensureAdminExists() {
  const row = db.prepare(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`).get();
  if (!row) {
    db.prepare(`
      INSERT INTO users (username, password, role, name, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(DEFAULT_USERNAME, DEFAULT_PASSWORD, "admin", "Admin", new Date().toISOString(), new Date().toISOString());
  }
}

export async function createLocalAuthToken(payload: LocalAuthPayload): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1y")
    .sign(SECRET_KEY);
}

export async function verifyLocalAuthToken(token: string): Promise<LocalAuthPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET_KEY, { clockTolerance: 60 });
    return {
      username: payload.username as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export function validateCredentials(username: string, password: string): boolean {
  ensureAdminExists();
  const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
  if (!user) return false;
  return user.password === password;
}

export function updateCredentials(username: string, currentPassword: string, newPassword?: string, newUsername?: string): AuthConfig {
  ensureAdminExists();
  const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
  if (!user || user.password !== currentPassword) {
    throw new Error("Current password is incorrect");
  }
  
  const finalUsername = newUsername || username;
  const finalPassword = newPassword || currentPassword;
  
  db.prepare(`UPDATE users SET password = ?, username = ? WHERE username = ?`).run(finalPassword, finalUsername, username);
  
  return {
    username: finalUsername,
    password: finalPassword,
  };
}

export function isDefaultCredentials(): boolean {
  ensureAdminExists();
  const user = db.prepare(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`).get() as any;
  return user && user.username === DEFAULT_USERNAME && user.password === DEFAULT_PASSWORD;
}

export function getAuthCookie(headers: Headers): string | undefined {
  const cookies = cookie.parse(headers.get("cookie") || "");
  return cookies[AUTH_COOKIE_NAME];
}

export function serializeAuthCookie(token: string): string {
  return cookie.serialize(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
    maxAge: COOKIE_MAX_AGE,
  });
}

export function serializeClearCookie(): string {
  return cookie.serialize(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
    maxAge: 0,
  });
}
