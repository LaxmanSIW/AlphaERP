import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { buyers, transactions, auditLogs } from "@db/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

export const transactionRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(25),
        bookType: z.enum(["CC", "CS", "ALL"]).optional().default("ALL"),
        search: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        transactionType: z.enum(["Sale", "Payment_Received", "ALL"]).optional().default("ALL"),
        buyerId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page || 1;
      const limit = input?.limit || 25;
      const offset = (page - 1) * limit;

      // Build conditions
      const conditions = [eq(transactions.deleted, false)];

      if (input?.bookType && input.bookType !== "ALL") {
        conditions.push(eq(transactions.bookType, input.bookType as "CC" | "CS"));
      }
      if (input?.transactionType && input.transactionType !== "ALL") {
        conditions.push(eq(transactions.transactionType, input.transactionType as "Sale" | "Payment_Received"));
      }
      if (input?.startDate) {
        conditions.push(sql`${transactions.transactionDate} >= ${input.startDate}`);
      }
      if (input?.endDate) {
        conditions.push(sql`${transactions.transactionDate} <= ${input.endDate}`);
      }
      if (input?.buyerId) {
        conditions.push(eq(transactions.buyerId, input.buyerId));
      }

      const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(transactions)
        .where(whereClause);
      const total = totalResult[0].count;

      // Get transactions with buyer info
      const items = await db
        .select({
          id: transactions.id,
          buyerId: transactions.buyerId,
          companyName: buyers.companyName,
          bookType: transactions.bookType,
          transactionDate: transactions.transactionDate,
          dueDate: transactions.dueDate,
          amount: transactions.amount,
          trouserQuantity: transactions.trouserQuantity,
          checkNumber: transactions.checkNumber,
          transactionType: transactions.transactionType,
          includeInReporting: transactions.includeInReporting,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .leftJoin(buyers, eq(transactions.buyerId, buyers.id))
        .where(whereClause)
        .orderBy(desc(transactions.transactionDate))
        .limit(limit)
        .offset(offset);

      // Apply search filter if provided (post-query for simplicity with joins)
      let filteredItems = items;
      if (input?.search) {
        const searchLower = input.search.toLowerCase();
        filteredItems = items.filter(item =>
          (item.companyName?.toLowerCase() || "").includes(searchLower) ||
          (item.checkNumber?.toLowerCase() || "").includes(searchLower)
        );
      }

      return {
        items: filteredItems,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),

  create: publicQuery
    .input(
      z.object({
        buyerId: z.number(),
        bookType: z.enum(["CC", "CS"]),
        transactionDate: z.string(),
        dueDate: z.string().optional(),
        amount: z.number().positive(),
        trouserQuantity: z.number().int().min(0).default(0),
        checkNumber: z.string().optional(),
        transactionType: z.enum(["Sale", "Payment_Received"]),
        includeInReporting: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Parse date - handle DDMMYY format
      const parseDate = (dateStr: string): string => {
        if (dateStr.includes("/") || dateStr.includes("-")) {
          const parts = dateStr.split(/[\/\-]/);
          if (parts.length === 3) {
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            return `${year}-${month}-${day}`;
          }
          return dateStr;
        }
        // Raw numeric: DDMMYY or DDMMYYYY
        const clean = dateStr.replace(/\D/g, "");
        if (clean.length === 6 || clean.length === 8) {
          const day = clean.substring(0, 2);
          const month = clean.substring(2, 4);
          const year = clean.length === 6 ? `20${clean.substring(4, 6)}` : clean.substring(4, 8);
          return `${year}-${month}-${day}`;
        }
        return dateStr;
      };

      const txDate = parseDate(input.transactionDate);
      const dueDate = input.dueDate ? parseDate(input.dueDate) : null;

      const result = await db.insert(transactions).values({
        buyerId: input.buyerId,
        bookType: input.bookType,
        transactionDate: new Date(txDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        amount: input.amount.toFixed(2),
        trouserQuantity: input.trouserQuantity,
        checkNumber: input.checkNumber || null,
        transactionType: input.transactionType,
        includeInReporting: input.includeInReporting,
      } as any);

      return { id: Number(result[0].insertId), message: "Transaction created successfully" };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        buyerId: z.number().optional(),
        bookType: z.enum(["CC", "CS"]).optional(),
        transactionDate: z.string().optional(),
        dueDate: z.string().optional(),
        amount: z.number().positive().optional(),
        trouserQuantity: z.number().int().min(0).optional(),
        checkNumber: z.string().optional(),
        transactionType: z.enum(["Sale", "Payment_Received"]).optional(),
        includeInReporting: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updateData } = input;

      // Get old values for audit
      const oldTransaction = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.deleted, false)))
        .limit(1);

      if (!oldTransaction[0]) {
        throw new Error("Transaction not found");
      }

      const updateValues: any = {};
      if (updateData.buyerId !== undefined) updateValues.buyerId = updateData.buyerId;
      if (updateData.bookType !== undefined) updateValues.bookType = updateData.bookType;
      if (updateData.transactionDate !== undefined) updateValues.transactionDate = updateData.transactionDate;
      if (updateData.dueDate !== undefined) updateValues.dueDate = updateData.dueDate || null;
      if (updateData.amount !== undefined) updateValues.amount = updateData.amount.toFixed(2);
      if (updateData.trouserQuantity !== undefined) updateValues.trouserQuantity = updateData.trouserQuantity;
      if (updateData.checkNumber !== undefined) updateValues.checkNumber = updateData.checkNumber || null;
      if (updateData.transactionType !== undefined) updateValues.transactionType = updateData.transactionType;
      if (updateData.includeInReporting !== undefined) updateValues.includeInReporting = updateData.includeInReporting;

      await db
        .update(transactions)
        .set(updateValues)
        .where(eq(transactions.id, id));

      // Create audit log
      await db.insert(auditLogs).values({
        tableName: "transactions",
        recordId: id,
        action: "UPDATE",
        oldValues: oldTransaction[0] as any,
        newValues: updateValues,
        userId: "system",
      });

      return { id, message: "Transaction updated successfully" };
    }),

  delete: publicQuery
    .input(
      z.object({
        id: z.number(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Get old values for audit
      const oldTransaction = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, input.id), eq(transactions.deleted, false)))
        .limit(1);

      if (!oldTransaction[0]) {
        throw new Error("Transaction not found");
      }

      // Soft delete
      await db
        .update(transactions)
        .set({
          deleted: true,
          deletedReason: input.reason,
          deletedAt: new Date(),
        })
        .where(eq(transactions.id, input.id));

      // Create audit log
      await db.insert(auditLogs).values({
        tableName: "transactions",
        recordId: input.id,
        action: "DELETE",
        oldValues: oldTransaction[0] as any,
        reason: input.reason,
        userId: "system",
      });

      return { id: input.id, message: "Transaction archived successfully" };
    }),

  bulkCreate: publicQuery
    .input(
      z.object({
        transactions: z.array(
          z.object({
            buyerName: z.string(),
            bookType: z.enum(["CC", "CS"]),
            transactionDate: z.string(),
            dueDate: z.string().optional(),
            transactionType: z.enum(["Sale", "Payment_Received"]),
            quantity: z.number().int().min(0).default(0),
            amount: z.number().positive(),
            checkNumber: z.string().optional(),
            includeInReporting: z.boolean().default(true),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      let imported = 0;
      let failed = 0;
      let newBuyers = 0;
      const errors: Array<{ row: number; message: string }> = [];

      // Create a map to cache buyer lookups
      const buyerCache = new Map<string, number>();

      for (let i = 0; i < input.transactions.length; i++) {
        const row = input.transactions[i];
        try {
          // Find or create buyer
          let buyerId = buyerCache.get(row.buyerName.toLowerCase());

          if (!buyerId) {
            const existingBuyer = await db
              .select()
              .from(buyers)
              .where(sql`LOWER(${buyers.companyName}) = ${row.buyerName.toLowerCase()}`)
              .limit(1);

            if (existingBuyer[0]) {
              buyerId = existingBuyer[0].id;
            } else {
              // Create new buyer
              const newBuyerResult = await db.insert(buyers).values({
                companyName: row.buyerName,
                creditLimit: "100000.00",
              });
              buyerId = Number(newBuyerResult[0].insertId);
              newBuyers++;
            }

            buyerCache.set(row.buyerName.toLowerCase(), buyerId);
          }

          // Parse date
          const parseDate = (dateStr: string): string => {
            if (dateStr.includes("/")) {
              const parts = dateStr.split("/");
              if (parts.length === 3) {
                const day = parts[0].padStart(2, "0");
                const month = parts[1].padStart(2, "0");
                const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                return `${year}-${month}-${day}`;
              }
            }
            return dateStr;
          };

          await db.insert(transactions).values({
            buyerId,
            bookType: row.bookType,
            transactionDate: new Date(parseDate(row.transactionDate)),
            dueDate: row.dueDate ? new Date(parseDate(row.dueDate)) : null,
            amount: row.amount.toFixed(2),
            trouserQuantity: row.quantity,
            checkNumber: row.checkNumber || null,
            transactionType: row.transactionType,
            includeInReporting: row.includeInReporting,
          } as any);

          imported++;
        } catch (error: any) {
          failed++;
          errors.push({ row: i + 1, message: error.message || "Unknown error" });
        }
      }

      return { imported, failed, newBuyers, errors };
    }),
});
