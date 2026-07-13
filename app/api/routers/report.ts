import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { buyers, transactions } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";

export const reportRouter = createRouter({
  outstanding: publicQuery
    .input(
      z.object({
        bookType: z.enum(["CC", "CS", "ALL"]).default("ALL"),
        riskLevel: z.enum(["High", "Medium", "Low", "ALL"]).default("ALL"),
        minAmount: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const bookCondition = input?.bookType && input.bookType !== "ALL"
        ? eq(transactions.bookType, input.bookType as "CC" | "CS")
        : undefined;

      // Get all active buyers with their transactions
      const allBuyers = await db.select().from(buyers);

      const results = [];
      for (const buyer of allBuyers) {
        const conditions = [
          eq(transactions.buyerId, buyer.id),
          eq(transactions.deleted, false),
        ];
        if (bookCondition) conditions.push(bookCondition);

        const salesResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              ...conditions,
              eq(transactions.transactionType, "Sale")
            )
          );

        const paymentsResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              ...conditions,
              eq(transactions.transactionType, "Payment_Received")
            )
          );

        const totalSales = parseFloat(salesResult[0]?.total || "0");
        const totalPaid = parseFloat(paymentsResult[0]?.total || "0");
        const outstanding = totalSales - totalPaid;

        if (outstanding > 0 && (!input?.minAmount || outstanding >= input.minAmount)) {
          // Get latest due date
          const latestTx = await db
            .select({ dueDate: transactions.dueDate, transactionDate: transactions.transactionDate })
            .from(transactions)
            .where(
              and(
                eq(transactions.buyerId, buyer.id),
                eq(transactions.deleted, false),
                eq(transactions.transactionType, "Sale")
              )
            )
            .orderBy(sql`${transactions.transactionDate} DESC`)
            .limit(1);

          const dueDate = latestTx[0]?.dueDate || latestTx[0]?.transactionDate;
          const daysOverdue = dueDate
            ? Math.max(0, Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          // Calculate risk
          const creditLimit = parseFloat(buyer.creditLimit as string || "0");
          const utilization = creditLimit > 0 ? outstanding / creditLimit : 0;
          let riskScore = 5;
          let riskLevel = "Medium";

          if (utilization > 0.8) {
            riskScore = 2;
            riskLevel = "High";
          } else if (utilization > 0.4) {
            riskScore = 5;
            riskLevel = "Medium";
          } else {
            riskScore = 8;
            riskLevel = "Low";
          }

          if (input?.riskLevel && input.riskLevel !== "ALL" && riskLevel !== input.riskLevel) {
            continue;
          }

          results.push({
            buyerId: buyer.id,
            companyName: buyer.companyName,
            bookType: input?.bookType || "ALL",
            totalSales,
            totalPaid,
            outstanding,
            dueDate,
            daysOverdue,
            riskScore,
            riskLevel,
          });
        }
      }

      return results.sort((a, b) => b.outstanding - a.outstanding);
    }),

  buyerStatement: publicQuery
    .input(
      z.object({
        buyerId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const buyer = await db
        .select()
        .from(buyers)
        .where(eq(buyers.id, input.buyerId))
        .limit(1);

      if (!buyer[0]) throw new Error("Buyer not found");

      const conditions = [
        eq(transactions.buyerId, input.buyerId),
        eq(transactions.deleted, false),
      ];
      if (input.startDate) conditions.push(sql`${transactions.transactionDate} >= ${input.startDate}`);
      if (input.endDate) conditions.push(sql`${transactions.transactionDate} <= ${input.endDate}`);

      const txItems = await db
        .select({
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

      let balance = 0;
      const items = txItems.map((tx) => {
        const amount = parseFloat(tx.amount as string);
        const debit = tx.transactionType === "Sale" ? amount : 0;
        const credit = tx.transactionType === "Payment_Received" ? amount : 0;
        balance = balance + debit - credit;

        return {
          date: tx.transactionDate,
          description: `${tx.transactionType}${tx.checkNumber ? ` (Chq: ${tx.checkNumber})` : ""}`,
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

  trouserMovement: publicQuery
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        bookType: z.enum(["CC", "CS", "ALL"]).default("ALL"),
        groupBy: z.enum(["Day", "Week", "Month", "Buyer"]).default("Day"),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const bookCondition = input.bookType !== "ALL"
        ? eq(transactions.bookType, input.bookType as "CC" | "CS")
        : undefined;

      const conditions = [
        eq(transactions.deleted, false),
        eq(transactions.transactionType, "Sale"),
        sql`${transactions.transactionDate} >= ${input.startDate}`,
        sql`${transactions.transactionDate} <= ${input.endDate}`,
      ];
      if (bookCondition) conditions.push(bookCondition);

      if (input.groupBy === "Buyer") {
        const movements = await db
          .select({
            buyerId: transactions.buyerId,
            ccQuantity: sql<string>`SUM(CASE WHEN ${transactions.bookType} = 'CC' THEN ${transactions.trouserQuantity} ELSE 0 END)`,
            csQuantity: sql<string>`SUM(CASE WHEN ${transactions.bookType} = 'CS' THEN ${transactions.trouserQuantity} ELSE 0 END)`,
            total: sql<string>`COALESCE(SUM(${transactions.trouserQuantity}), 0)`,
          })
          .from(transactions)
          .where(and(...conditions))
          .groupBy(transactions.buyerId);

        const results = [];
        let cumulative = 0;
        for (const m of movements) {
          const total = parseInt(m.total);
          cumulative += total;
          const buyerInfo = await db
            .select()
            .from(buyers)
            .where(eq(buyers.id, m.buyerId))
            .limit(1);

          results.push({
            buyer: buyerInfo[0]?.companyName || `Buyer ${m.buyerId}`,
            ccQuantity: parseInt(m.ccQuantity),
            csQuantity: parseInt(m.csQuantity),
            total,
            cumulative,
          });
        }

        const totalPieces = results.reduce((sum, r) => sum + r.total, 0);
        return {
          items: results,
          summary: {
            totalPieces,
            averagePerDay: Math.round(totalPieces / Math.max(1, results.length)),
            peakDay: results.length > 0 ? results.reduce((a, b) => a.total > b.total ? a : b).buyer : "",
            peakCount: results.length > 0 ? Math.max(...results.map(r => r.total)) : 0,
          },
        };
      }

      // Day/Week/Month grouping
      const txItems = await db
        .select({
          transactionDate: transactions.transactionDate,
          bookType: transactions.bookType,
          trouserQuantity: transactions.trouserQuantity,
        })
        .from(transactions)
        .where(and(...conditions))
        .orderBy(transactions.transactionDate);

      // Group by date
      const grouped = new Map<string, { cc: number; cs: number; total: number }>();

      for (const tx of txItems) {
        const date = new Date(tx.transactionDate);
        let key: string;

        if (input.groupBy === "Week") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
        } else if (input.groupBy === "Month") {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
        } else {
          key = new Date(tx.transactionDate).toISOString().split("T")[0];
        }

        const existing = grouped.get(key) || { cc: 0, cs: 0, total: 0 };
        const qty = tx.trouserQuantity || 0;
        existing.total += qty;
        if (tx.bookType === "CC") existing.cc += qty;
        else existing.cs += qty;
        grouped.set(key, existing);
      }

      const sortedKeys = Array.from(grouped.keys()).sort();
      let cumulative = 0;
      const items = sortedKeys.map((key) => {
        const data = grouped.get(key)!;
        cumulative += data.total;
        return {
          date: key,
          ccQuantity: data.cc,
          csQuantity: data.cs,
          total: data.total,
          cumulative,
        };
      });

      const totalPieces = items.reduce((sum, r) => sum + r.total, 0);
      const days = Math.max(1, sortedKeys.length);

      return {
        items,
        summary: {
          totalPieces,
          averagePerDay: Math.round(totalPieces / days),
          peakDay: items.length > 0 ? items.reduce((a, b) => a.total > b.total ? a : b).date : "",
          peakCount: items.length > 0 ? Math.max(...items.map(r => r.total)) : 0,
        },
      };
    }),
});
