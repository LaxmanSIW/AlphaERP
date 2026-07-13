import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "./json-db/types";
import { verifyLocalAuthToken, getAuthCookie } from "./local-auth";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    const token = getAuthCookie(opts.req.headers);
    if (token) {
      const payload = await verifyLocalAuthToken(token);
      if (payload) {
        // Create a synthetic user object for local auth
        ctx.user = {
          id: 1,
          unionId: "local-admin",
          name: payload.username,
          email: `${payload.username}@local`,
          avatar: null,
          role: payload.role as "user" | "admin",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSignInAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Authentication is optional here
  }
  return ctx;
}
