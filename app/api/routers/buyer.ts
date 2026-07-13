import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { buyers, transactions } from "@db/schema";
import { eq, and, like, desc, sql, count } from "drizzle-orm";

export const buyerRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(25),
        search: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page || 1;
      const limit = input?.limit || 25;
      const offset = (page - 1) * limit;

      // Build conditions
      const conditions = [];
      if (input?.search) {
        conditions.push(
          like(buyers.companyName, `%${input.search}%`)
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(buyers)
        .where(whereClause);
      const total = totalResult[0].count;

      // Get buyers
      const items = await db
        .select()
        .from(buyers)
        .where(whereClause)
        .orderBy(input?.sortOrder === "desc" ? desc(buyers.companyName) : buyers.companyName)
        .limit(limit)
        .offset(offset);

      // Calculate outstanding for each buyer
      const itemsWithStats = [];
      for (const buyer of items) {
        const salesResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.buyerId, buyer.id),
              eq(transactions.deleted, false),
              eq(transactions.transactionType, "Sale")
            )
          );

        const paymentsResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.buyerId, buyer.id),
              eq(transactions.deleted, false),
              eq(transactions.transactionType, "Payment_Received")
            )
          );

        const totalSales = parseFloat(salesResult[0]?.total || "0");
        const totalPaid = parseFloat(paymentsResult[0]?.total || "0");

        itemsWithStats.push({
          ...buyer,
          totalSales,
          totalPaid,
          outstanding: totalSales - totalPaid,
        });
      }

      return {
        items: itemsWithStats,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),

  create: publicQuery
    .input(
      z.object({
        companyName: z.string().min(1),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        gstNumber: z.string().optional(),
        creditLimit: z.number().min(0).default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const result = await db.insert(buyers).values({
        companyName: input.companyName,
        contactPerson: input.contactPerson || null,
        phone: input.phone || null,
        gstNumber: input.gstNumber || null,
        creditLimit: input.creditLimit.toFixed(2) as any,
      } as any);

      return { id: Number(result[0].insertId), message: "Buyer created successfully" };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        companyName: z.string().optional(),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        gstNumber: z.string().optional(),
        creditLimit: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updateData } = input;

      const updateValues: any = {};
      if (updateData.companyName !== undefined) updateValues.companyName = updateData.companyName;
      if (updateData.contactPerson !== undefined) updateValues.contactPerson = updateData.contactPerson || null;
      if (updateData.phone !== undefined) updateValues.phone = updateData.phone || null;
      if (updateData.gstNumber !== undefined) updateValues.gstNumber = updateData.gstNumber || null;
      if (updateData.creditLimit !== undefined) updateValues.creditLimit = updateData.creditLimit.toFixed(2) as any;

      await db.update(buyers).set(updateValues as any).where(eq(buyers.id, id));

      return { id, message: "Buyer updated successfully" };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check if buyer has transactions
      const txCount = await db
        .select({ count: count() })
        .from(transactions)
        .where(eq(transactions.buyerId, input.id));

      if (txCount[0].count > 0) {
        throw new Error("Cannot delete buyer with existing transactions");
      }

      await db.delete(buyers).where(eq(buyers.id, input.id));

      return { message: "Buyer deleted successfully" };
    }),

  detail: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const buyer = await db
        .select()
        .from(buyers)
        .where(eq(buyers.id, input.id))
        .limit(1);

      if (!buyer[0]) {
        throw new Error("Buyer not found");
      }

      // Calculate stats
      const salesResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.buyerId, input.id),
            eq(transactions.deleted, false),
            eq(transactions.transactionType, "Sale")
          )
        );

      const paymentsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.buyerId, input.id),
            eq(transactions.deleted, false),
            eq(transactions.transactionType, "Payment_Received")
          )
        );

      const txCountResult = await db
        .select({ count: count() })
        .from(transactions)
        .where(and(eq(transactions.buyerId, input.id), eq(transactions.deleted, false)));

      const totalSales = parseFloat(salesResult[0]?.total || "0");
      const totalPaid = parseFloat(paymentsResult[0]?.total || "0");

      return {
        ...buyer[0],
        totalSales,
        totalPaid,
        outstanding: totalSales - totalPaid,
        transactionCount: txCountResult[0].count,
      };
    }),

  statement: publicQuery
    .input(
      z.object({
        id: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const buyer = await db
        .select()
        .from(buyers)
        .where(eq(buyers.id, input.id))
        .limit(1);

      if (!buyer[0]) {
        throw new Error("Buyer not found");
      }

      // Build conditions
      const conditions = [
        eq(transactions.buyerId, input.id),
        eq(transactions.deleted, false),
      ];
      if (input.startDate) conditions.push(sql`${transactions.transactionDate} >= ${input.startDate}`);
      if (input.endDate) conditions.push(sql`${transactions.transactionDate} <= ${input.endDate}`);

      const txItems = await db
        .select({
          id: transactions.id,
          transactionDate: transactions.transactionDate,
          bookType: transactions.bookType,
          transactionType: transactions.transactionType,
          amount: transactions.amount,
          checkNumber: transactions.checkNumber,
          trouserQuantity: transactions.trouserQuantity,
        })
        .from(transactions)
        .where(and(...conditions))
        .orderBy(transactions.transactionDate);

      // Calculate running balance
      let balance = 0;
      const items = txItems.map((tx) => {
        const amount = parseFloat(tx.amount as string);
        const debit = tx.transactionType === "Sale" ? amount : 0;
        const credit = tx.transactionType === "Payment_Received" ? amount : 0;
        balance = balance + debit - credit;

        return {
          id: tx.id,
          date: tx.transactionDate,
          description: `${tx.transactionType}${tx.checkNumber ? ` - Chq: ${tx.checkNumber}` : ""}`,
          bookType: tx.bookType,
          type: tx.transactionType,
          debit,
          credit,
          balance,
          quantity: tx.trouserQuantity,
        };
      });

      return {
        buyer: buyer[0],
        openingBalance: 0,
        items,
        closingBalance: balance,
      };
    }),

  riskAnalysis: publicQuery
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();

      const allBuyers = await db
        .select()
        .from(buyers)
        .where(input?.search ? like(buyers.companyName, `%${input.search}%`) : undefined);

      const result = [];
      for (const buyer of allBuyers) {
        // Calculate total sales and payments
        const salesResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.buyerId, buyer.id),
              eq(transactions.deleted, false),
              eq(transactions.transactionType, "Sale")
            )
          );

        const paymentsResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.buyerId, buyer.id),
              eq(transactions.deleted, false),
              eq(transactions.transactionType, "Payment_Received")
            )
          );

        const outstanding = parseFloat(salesResult[0]?.total || "0") - parseFloat(paymentsResult[0]?.total || "0");
        const creditLimit = parseFloat(buyer.creditLimit as string || "0");
        const creditUtilization = creditLimit > 0 ? outstanding / creditLimit : 0;

        // Simplified risk scoring (without actual payment date analysis for now)
        let riskScore = 5;
        if (creditUtilization > 0.8 || outstanding > creditLimit * 0.8) {
          riskScore = Math.max(1, Math.min(3, Math.round(creditUtilization * 10)));
        } else if (creditUtilization > 0.4) {
          riskScore = Math.max(4, Math.min(7, 4 + Math.round(creditUtilization * 10)));
        } else {
          riskScore = Math.max(8, Math.min(10, 10 - Math.round(creditUtilization * 10)));
        }

        let riskLevel = "Medium";
        if (riskScore <= 3) riskLevel = "High";
        else if (riskScore >= 8) riskLevel = "Low";

        result.push({
          buyer,
          riskScore,
          riskLevel,
          outstanding,
          creditUtilization,
        });
      }

      return result;
    }),
});
