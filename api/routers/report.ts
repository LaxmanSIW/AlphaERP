import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { findAll, findById, findMany } from "../queries/connection";
import type { Buyer, Transaction } from "../queries/connection";

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
      const allBuyers = findAll<Buyer>("buyers");
      const allTxs = findAll<Transaction>("transactions").filter(t => !t.deleted);

      const bookFilter = input?.bookType && input.bookType !== "ALL"
        ? (t: Transaction) => t.bookType === input.bookType
        : () => true;

      const results = [];
      for (const buyer of allBuyers) {
        const buyerTxs = allTxs.filter(t => t.buyerId === buyer.id).filter(bookFilter);
        const totalSales = buyerTxs
          .filter(t => t.transactionType === "Sale")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalPaid = buyerTxs
          .filter(t => t.transactionType === "Payment_Received")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const outstanding = totalSales - totalPaid;

        if (outstanding > 0 && (!input?.minAmount || outstanding >= input.minAmount)) {
          // Get latest due date
          const saleTxs = buyerTxs
            .filter(t => t.transactionType === "Sale")
            .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
          const latestTx = saleTxs[0];

          const dueDate = latestTx?.dueDate || latestTx?.transactionDate;
          const daysOverdue = dueDate
            ? Math.max(0, Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          // Calculate risk
          const creditLimit = parseFloat(buyer.creditLimit || "0");
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
      const buyer = findById<Buyer>("buyers", input.buyerId);
      if (!buyer) throw new Error("Buyer not found");

      let txItems = findAll<Transaction>("transactions").filter(
        t => !t.deleted && t.buyerId === input.buyerId
      );

      if (input.startDate) txItems = txItems.filter(t => t.transactionDate >= input.startDate!);
      if (input.endDate) txItems = txItems.filter(t => t.transactionDate <= input.endDate!);

      txItems.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));

      let balance = 0;
      const items = txItems.map(tx => {
        const amount = parseFloat(tx.amount);
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
        buyer,
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
      const allBuyers = findAll<Buyer>("buyers");
      const bookFilter = input.bookType !== "ALL"
        ? (t: Transaction) => t.bookType === input.bookType
        : () => true;

      let txItems = findAll<Transaction>("transactions").filter(
        t => !t.deleted && t.transactionType === "Sale" &&
        t.transactionDate >= input.startDate && t.transactionDate <= input.endDate
      ).filter(bookFilter);

      if (input.groupBy === "Buyer") {
        const buyerMap = new Map<number, { cc: number; cs: number; total: number }>();

        for (const tx of txItems) {
          const existing = buyerMap.get(tx.buyerId) || { cc: 0, cs: 0, total: 0 };
          const qty = tx.trouserQuantity || 0;
          existing.total += qty;
          if (tx.bookType === "CC") existing.cc += qty;
          else existing.cs += qty;
          buyerMap.set(tx.buyerId, existing);
        }

        const results = [];
        let cumulative = 0;
        for (const [buyerId, data] of buyerMap) {
          cumulative += data.total;
          const buyerInfo = allBuyers.find(b => b.id === buyerId);
          results.push({
            buyer: buyerInfo?.companyName || `Buyer ${buyerId}`,
            ccQuantity: data.cc,
            csQuantity: data.cs,
            total: data.total,
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
          key = tx.transactionDate;
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
      const items = sortedKeys.map(key => {
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

  salesPeriod: publicQuery
    .input(
      z.object({
        period: z.enum(["Monthly", "Weekly"]).default("Monthly"),
        paymentType: z.enum(["ALL", "CC", "CS"]).default("ALL"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        buyerId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const now = new Date();

      let effectiveStart = input.startDate;
      let effectiveEnd = input.endDate;

      if (!effectiveStart) {
        const d = new Date();
        if (input.period === "Monthly") {
          d.setMonth(d.getMonth() - 11);
          d.setDate(1);
        } else {
          d.setDate(d.getDate() - 77);
        }
        effectiveStart = d.toISOString().split("T")[0];
      }
      if (!effectiveEnd) {
        effectiveEnd = now.toISOString().split("T")[0];
      }

      const bookFilter = input.paymentType !== "ALL"
        ? (t: Transaction) => t.bookType === input.paymentType
        : () => true;

      let txItems = findAll<Transaction>("transactions").filter(
        t => !t.deleted && t.transactionDate >= effectiveStart! && t.transactionDate <= effectiveEnd!
      ).filter(bookFilter);

      if (input.buyerId) {
        txItems = txItems.filter(t => t.buyerId === input.buyerId);
      }

      txItems.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));

      const grouped = new Map<string, { ccSales: number; csSales: number; totalSales: number; totalPayments: number }>();

      for (const tx of txItems) {
        const date = new Date(tx.transactionDate);
        let key: string;

        if (input.period === "Weekly") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }

        const existing = grouped.get(key) || { ccSales: 0, csSales: 0, totalSales: 0, totalPayments: 0 };
        const amount = parseFloat(tx.amount);

        if (tx.transactionType === "Sale") {
          existing.totalSales += amount;
          if (tx.bookType === "CC") existing.ccSales += amount;
          else existing.csSales += amount;
        } else if (tx.transactionType === "Payment_Received") {
          existing.totalPayments += amount;
        }

        grouped.set(key, existing);
      }

      const sortedKeys = Array.from(grouped.keys()).sort();
      const items = sortedKeys.map(key => {
        const data = grouped.get(key)!;
        let periodLabel: string;

        if (input.period === "Weekly") {
          const d = new Date(key);
          periodLabel = `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
        } else {
          const [year, month] = key.split("-");
          const d = new Date(parseInt(year), parseInt(month) - 1);
          periodLabel = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        }

        return {
          period: periodLabel,
          rawKey: key,
          ccSales: Math.round(data.ccSales * 100) / 100,
          csSales: Math.round(data.csSales * 100) / 100,
          totalSales: Math.round(data.totalSales * 100) / 100,
          totalPayments: Math.round(data.totalPayments * 100) / 100,
          netAmount: Math.round((data.totalSales - data.totalPayments) * 100) / 100,
        };
      });

      const totalSales = items.reduce((sum, i) => sum + i.totalSales, 0);
      const totalPayments = items.reduce((sum, i) => sum + i.totalPayments, 0);

      return {
        items,
        summary: {
          totalSales: Math.round(totalSales * 100) / 100,
          totalPayments: Math.round(totalPayments * 100) / 100,
          netAmount: Math.round((totalSales - totalPayments) * 100) / 100,
          periodCount: items.length,
        },
      };
    }),
});
