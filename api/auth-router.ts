import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import {
  validateCredentials,
  createLocalAuthToken,
  serializeAuthCookie,
  serializeClearCookie,
  changePassword,
} from "./local-auth";

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  login: publicQuery
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!validateCredentials(input.username, input.password)) {
        throw new Error("Invalid username or password");
      }

      const token = await createLocalAuthToken({
        username: input.username,
        role: "admin",
      });

      ctx.resHeaders.append("set-cookie", serializeAuthCookie(token));

      return {
        success: true,
        user: {
          id: 1,
          name: input.username,
          role: "admin",
          email: `${input.username}@local`,
        },
      };
    }),

  changePassword: authedQuery
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(4),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const username = ctx.user?.name || "admin";
      const updated = changePassword(username, input.currentPassword, input.newPassword);

      return {
        success: true,
        username: updated.username,
      };
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    ctx.resHeaders.append("set-cookie", serializeClearCookie());
    return { success: true };
  }),
});
