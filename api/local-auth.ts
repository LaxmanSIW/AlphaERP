import * as cookie from "cookie";
import * as jose from "jose";
import fs from "node:fs";
import path from "node:path";
import { env } from "./lib/env";

const SECRET_KEY = new TextEncoder().encode(env.appSecret || "alpha-erp-local-secret-key-2026");

export const AUTH_COOKIE_NAME = "alpha_auth";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds
const AUTH_CONFIG_PATH = path.resolve(process.cwd(), ".auth.json");

// Default admin credentials
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin";

type AuthConfig = {
  username: string;
  password: string;
};

export interface LocalAuthPayload {
  username: string;
  role: string;
}

function defaultAuthConfig(): AuthConfig {
  return {
    username: DEFAULT_USERNAME,
    password: DEFAULT_PASSWORD,
  };
}

function readAuthConfig(): AuthConfig {
  if (!fs.existsSync(AUTH_CONFIG_PATH)) {
    return defaultAuthConfig();
  }

  try {
    const raw = fs.readFileSync(AUTH_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthConfig>;
    return {
      username: parsed.username || DEFAULT_USERNAME,
      password: parsed.password || DEFAULT_PASSWORD,
    };
  } catch {
    return defaultAuthConfig();
  }
}

function writeAuthConfig(config: AuthConfig): void {
  fs.mkdirSync(path.dirname(AUTH_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(AUTH_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
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
  const config = readAuthConfig();
  return username === config.username && password === config.password;
}

export function changePassword(username: string, currentPassword: string, newPassword: string): AuthConfig {
  const config = readAuthConfig();
  if (username !== config.username || currentPassword !== config.password) {
    throw new Error("Current password is incorrect");
  }

  const updated = {
    username: config.username,
    password: newPassword,
  };

  writeAuthConfig(updated);
  return updated;
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
