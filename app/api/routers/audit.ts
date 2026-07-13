import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { auditLogs } from "@db/schema";
import { eq, and, desc, count } from "drizzle-orm";

export const auditRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(25),
        tableName: z.string().optional(),
        action: z.enum(["UPDATE", "DELETE", "ALL"]).default("ALL"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page || 1;
      const limit = input?.limit || 25;
      const offset = (page - 1) * limit;

      // Build conditions
      const conditions = [];
      if (input?.tableName) {
        conditions.push(eq(auditLogs.tableName, input.tableName));
      }
      if (input?.action && input.action !== "ALL") {
        conditions.push(eq(auditLogs.action, input.action as "UPDATE" | "DELETE"));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause);
      const total = totalResult[0].count;

      // Get audit logs
      const items = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),
});
