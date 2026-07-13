import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { buyers, transactions } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const dashboardRouter = createRouter({
  stats: publicQuery
    .input(
      z.object({
        bookType: z.enum(["CC", "CS", "ALL"]).optional().default("ALL"),
        month: z.string().optional(),
        year: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const now = new Date();
      const currentMonth = input?.month ? parseInt(input.month) : now.getMonth() + 1;
      const currentYear = input?.year ? parseInt(input.year) : now.getFullYear();
      
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
      const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-31`;

      // Build book type condition
      const bookCondition = input?.bookType && input.bookType !== "ALL"
        ? eq(transactions.bookType, input.bookType as "CC" | "CS")
        : undefined;

      const baseConditions = and(
        eq(transactions.deleted, false),
        sql`${transactions.transactionDate} >= ${startOfMonth}`,
        sql`${transactions.transactionDate} <= ${endOfMonth}`,
        bookCondition
      );

      // Total Sales
      const salesResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            baseConditions,
            eq(transactions.transactionType, "Sale")
          )
        );

      // Total Payments
      const paymentsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            baseConditions,
            eq(transactions.transactionType, "Payment_Received")
          )
        );

      // Outstanding (all time, not filtered by month)
      const outstandingBookCondition = input?.bookType && input.bookType !== "ALL"
        ? eq(transactions.bookType, input.bookType as "CC" | "CS")
        : undefined;

      const allSalesResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.deleted, false),
            eq(transactions.transactionType, "Sale"),
            outstandingBookCondition
          )
        );

      const allPaymentsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.deleted, false),
            eq(transactions.transactionType, "Payment_Received"),
            outstandingBookCondition
          )
        );

      // Total Pieces (only included in reporting)
      const piecesResult = await db
        .select({ total: sql<string>`COALESCE(SUM(${transactions.trouserQuantity}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.deleted, false),
            eq(transactions.transactionType, "Sale"),
            eq(transactions.includeInReporting, true),
            bookCondition
          )
        );

      const totalSales = parseFloat(salesResult[0]?.total || "0");
      const totalPayments = parseFloat(paymentsResult[0]?.total || "0");
      const allSales = parseFloat(allSalesResult[0]?.total || "0");
      const allPayments = parseFloat(allPaymentsResult[0]?.total || "0");
      const totalOutstanding = allSales - allPayments;
      const totalPieces = parseInt(piecesResult[0]?.total || "0");

      return {
        totalSales,
        totalPayments,
        totalOutstanding,
        totalPieces,
        periodLabel: `${new Date(currentYear, currentMonth - 1).toLocaleString("default", { month: "long" })} ${currentYear}`,
      };
    }),

  topDebtors: publicQuery
    .input(
      z.object({
        limit: z.number().default(5),
        bookType: z.enum(["CC", "CS", "ALL"]).optional().default("ALL"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 5;
      const bookCondition = input?.bookType && input.bookType !== "ALL"
        ? eq(transactions.bookType, input.bookType as "CC" | "CS")
        : undefined;

      const baseWhere = and(eq(transactions.deleted, false), bookCondition);

      // Get all buyers with their transaction totals
      const buyerTransactions = await db
        .select({
          buyerId: transactions.buyerId,
          totalSales: sql<string>`SUM(CASE WHEN ${transactions.transactionType} = 'Sale' THEN ${transactions.amount} ELSE 0 END)`,
          totalPayments: sql<string>`SUM(CASE WHEN ${transactions.transactionType} = 'Payment_Received' THEN ${transactions.amount} ELSE 0 END)`,
        })
        .from(transactions)
        .where(baseWhere)
        .groupBy(transactions.buyerId);

      // Calculate outstanding and get buyer details
      const debtors = [];
      for (const bt of buyerTransactions) {
        const outstanding = parseFloat(bt.totalSales || "0") - parseFloat(bt.totalPayments || "0");
        if (outstanding > 0) {
          const buyerInfo = await db
            .select()
            .from(buyers)
            .where(eq(buyers.id, bt.buyerId))
            .limit(1);
          
          if (buyerInfo[0]) {
            debtors.push({
              buyerId: bt.buyerId,
              companyName: buyerInfo[0].companyName,
              outstanding,
            });
          }
        }
      }

      return debtors.sort((a, b) => b.outstanding - a.outstanding).slice(0, limit);
    }),

  topPaymasters: publicQuery
    .input(
      z.object({
        limit: z.number().default(5),
        days: z.number().default(30),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 5;
      const days = input?.days || 30;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];

      const paymasters = await db
        .select({
          buyerId: transactions.buyerId,
          totalPaid: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.deleted, false),
            eq(transactions.transactionType, "Payment_Received"),
            sql`${transactions.transactionDate} >= ${cutoffStr}`
          )
        )
        .groupBy(transactions.buyerId)
        .orderBy(desc(sql`totalPaid`))
        .limit(limit);

      const result = [];
      for (const pm of paymasters) {
        const buyerInfo = await db
          .select()
          .from(buyers)
          .where(eq(buyers.id, pm.buyerId))
          .limit(1);
        
        if (buyerInfo[0]) {
          result.push({
            buyerId: pm.buyerId,
            companyName: buyerInfo[0].companyName,
            totalPaid: parseFloat(pm.totalPaid),
          });
        }
      }

      return result;
    }),

  topVolumeBuyers: publicQuery
    .input(
      z.object({
        limit: z.number().default(5),
        month: z.string().optional(),
        year: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 5;

      const volumeBuyers = await db
        .select({
          buyerId: transactions.buyerId,
          totalQuantity: sql<string>`COALESCE(SUM(${transactions.trouserQuantity}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.deleted, false),
            eq(transactions.transactionType, "Sale")
          )
        )
        .groupBy(transactions.buyerId)
        .orderBy(desc(sql`totalQuantity`))
        .limit(limit);

      const result = [];
      for (const vb of volumeBuyers) {
        const buyerInfo = await db
          .select()
          .from(buyers)
          .where(eq(buyers.id, vb.buyerId))
          .limit(1);
        
        if (buyerInfo[0]) {
          result.push({
            buyerId: vb.buyerId,
            companyName: buyerInfo[0].companyName,
            totalQuantity: parseInt(vb.totalQuantity),
          });
        }
      }

      return result;
    }),

  monthlyTrends: publicQuery
    .input(
      z.object({
        months: z.number().default(12),
        bookType: z.enum(["CC", "CS", "ALL"]).optional().default("ALL"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const months = input?.months || 12;
      const bookCondition = input?.bookType && input.bookType !== "ALL"
        ? eq(transactions.bookType, input.bookType as "CC" | "CS")
        : undefined;

      const now = new Date();
      const data = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const monthEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-31`;

        const salesResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.deleted, false),
              eq(transactions.transactionType, "Sale"),
              sql`${transactions.transactionDate} >= ${monthStart}`,
              sql`${transactions.transactionDate} <= ${monthEnd}`,
              bookCondition
            )
          );

        const paymentsResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.deleted, false),
              eq(transactions.transactionType, "Payment_Received"),
              sql`${transactions.transactionDate} >= ${monthStart}`,
              sql`${transactions.transactionDate} <= ${monthEnd}`,
              bookCondition
            )
          );

        data.push({
          month: d.toLocaleString("default", { month: "short" }),
          year: d.getFullYear(),
          sales: parseFloat(salesResult[0]?.total || "0"),
          payments: parseFloat(paymentsResult[0]?.total || "0"),
        });
      }

      return data;
    }),

  monthlyQuantity: publicQuery
    .input(
      z.object({
        months: z.number().default(12),
        bookType: z.enum(["CC", "CS", "ALL"]).optional().default("ALL"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const months = input?.months || 12;
      const bookCondition = input?.bookType && input.bookType !== "ALL"
        ? eq(transactions.bookType, input.bookType as "CC" | "CS")
        : undefined;

      const now = new Date();
      const data = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const monthEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-31`;

        const quantityResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.trouserQuantity}), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.deleted, false),
              eq(transactions.transactionType, "Sale"),
              eq(transactions.includeInReporting, true),
              sql`${transactions.transactionDate} >= ${monthStart}`,
              sql`${transactions.transactionDate} <= ${monthEnd}`,
              bookCondition
            )
          );

        data.push({
          month: d.toLocaleString("default", { month: "short" }),
          year: d.getFullYear(),
          quantity: parseInt(quantityResult[0]?.total || "0"),
        });
      }

      return data;
    }),
});
