import * as cookie from "cookie";
import * as jose from "jose";
import { env } from "./lib/env";

const SECRET_KEY = new TextEncoder().encode(env.appSecret || "alpha-erp-local-secret-key-2026");

export const AUTH_COOKIE_NAME = "alpha_auth";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

// Default admin credentials
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";

export interface LocalAuthPayload {
  username: string;
  role: string;
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
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
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
