import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { findAll, findMany } from "../queries/connection";
import type { Buyer, Transaction } from "../queries/connection";

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
      const now = new Date();
      const currentMonth = input?.month ? parseInt(input.month) : now.getMonth() + 1;
      const currentYear = input?.year ? parseInt(input.year) : now.getFullYear();

      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
      const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-31`;

      const allTxs = findAll<Transaction>("transactions").filter(t => !t.deleted);

      // Filter by month/year
      const monthTxs = allTxs.filter(t => t.transactionDate >= startOfMonth && t.transactionDate <= endOfMonth);

      // Filter by book type
      const bookFilter = input?.bookType && input.bookType !== "ALL"
        ? (t: Transaction) => t.bookType === input.bookType
        : () => true;

      const filteredMonthTxs = monthTxs.filter(bookFilter);

      // Total Sales for period
      const totalSales = filteredMonthTxs
        .filter(t => t.transactionType === "Sale")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      // Total Payments for period
      const totalPayments = filteredMonthTxs
        .filter(t => t.transactionType === "Payment_Received")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      // Outstanding (all time)
      const outstandingTxs = allTxs.filter(bookFilter);
      const allSales = outstandingTxs
        .filter(t => t.transactionType === "Sale")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const allPayments = outstandingTxs
        .filter(t => t.transactionType === "Payment_Received")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalOutstanding = allSales - allPayments;

      // Total Pieces (only included in reporting)
      const totalPieces = filteredMonthTxs
        .filter(t => t.transactionType === "Sale" && t.includeInReporting)
        .reduce((sum, t) => sum + (t.trouserQuantity || 0), 0);

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
      const limit = input?.limit || 5;
      const allBuyers = findAll<Buyer>("buyers");
      const allTxs = findAll<Transaction>("transactions").filter(t => !t.deleted);

      const bookFilter = input?.bookType && input.bookType !== "ALL"
        ? (t: Transaction) => t.bookType === input.bookType
        : () => true;

      const debtors = [];
      for (const buyer of allBuyers) {
        const buyerTxs = allTxs.filter(t => t.buyerId === buyer.id).filter(bookFilter);
        const totalSales = buyerTxs
          .filter(t => t.transactionType === "Sale")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalPayments = buyerTxs
          .filter(t => t.transactionType === "Payment_Received")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const outstanding = totalSales - totalPayments;

        if (outstanding > 0) {
          debtors.push({
            buyerId: buyer.id,
            companyName: buyer.companyName,
            outstanding,
          });
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
      const limit = input?.limit || 5;
      const days = input?.days || 30;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];

      const allBuyers = findAll<Buyer>("buyers");
      const allTxs = findAll<Transaction>("transactions").filter(
        t => !t.deleted && t.transactionType === "Payment_Received" && t.transactionDate >= cutoffStr
      );

      // Group by buyer
      const paymentMap = new Map<number, number>();
      for (const tx of allTxs) {
        paymentMap.set(tx.buyerId, (paymentMap.get(tx.buyerId) || 0) + parseFloat(tx.amount));
      }

      const result = [];
      for (const [buyerId, totalPaid] of paymentMap) {
        const buyer = allBuyers.find(b => b.id === buyerId);
        if (buyer) {
          result.push({
            buyerId,
            companyName: buyer.companyName,
            totalPaid,
          });
        }
      }

      return result.sort((a, b) => b.totalPaid - a.totalPaid).slice(0, limit);
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
      const limit = input?.limit || 5;
      const allBuyers = findAll<Buyer>("buyers");
      const allTxs = findAll<Transaction>("transactions").filter(
        t => !t.deleted && t.transactionType === "Sale"
      );

      const volumeMap = new Map<number, number>();
      for (const tx of allTxs) {
        volumeMap.set(tx.buyerId, (volumeMap.get(tx.buyerId) || 0) + (tx.trouserQuantity || 0));
      }

      const result = [];
      for (const [buyerId, totalQuantity] of volumeMap) {
        const buyer = allBuyers.find(b => b.id === buyerId);
        if (buyer) {
          result.push({
            buyerId,
            companyName: buyer.companyName,
            totalQuantity,
          });
        }
      }

      return result.sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, limit);
    }),

  monthlyTrends: publicQuery
    .input(
      z.object({
        months: z.number().default(12),
        bookType: z.enum(["CC", "CS", "ALL"]).optional().default("ALL"),
      }).optional()
    )
    .query(async ({ input }) => {
      const months = input?.months || 12;
      const bookFilter = input?.bookType && input.bookType !== "ALL"
        ? (t: Transaction) => t.bookType === input.bookType
        : () => true;

      const allTxs = findAll<Transaction>("transactions").filter(t => !t.deleted).filter(bookFilter);

      const now = new Date();
      const data = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const monthEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-31`;

        const monthTxs = allTxs.filter(t => t.transactionDate >= monthStart && t.transactionDate <= monthEnd);
        const sales = monthTxs
          .filter(t => t.transactionType === "Sale")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const payments = monthTxs
          .filter(t => t.transactionType === "Payment_Received")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        data.push({
          month: d.toLocaleString("default", { month: "short" }),
          year: d.getFullYear(),
          sales,
          payments,
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
      const months = input?.months || 12;
      const bookFilter = input?.bookType && input.bookType !== "ALL"
        ? (t: Transaction) => t.bookType === input.bookType
        : () => true;

      const allTxs = findAll<Transaction>("transactions").filter(
        t => !t.deleted && t.transactionType === "Sale" && t.includeInReporting
      ).filter(bookFilter);

      const now = new Date();
      const data = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const monthEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-31`;

        const quantity = allTxs
          .filter(t => t.transactionDate >= monthStart && t.transactionDate <= monthEnd)
          .reduce((sum, t) => sum + (t.trouserQuantity || 0), 0);

        data.push({
          month: d.toLocaleString("default", { month: "short" }),
          year: d.getFullYear(),
          quantity,
        });
      }

      return data;
    }),

  allTimeSales: publicQuery
    .input(
      z.object({
        bookType: z.enum(["CC", "CS", "ALL"]).optional().default("ALL"),
      }).optional()
    )
    .query(async ({ input }) => {
      const bookFilter = input?.bookType && input.bookType !== "ALL"
        ? (t: Transaction) => t.bookType === input.bookType
        : () => true;

      const allTxs = findAll<Transaction>("transactions").filter(
        t => !t.deleted && t.transactionType === "Sale"
      ).filter(bookFilter);

      const totalSaleAmount = allTxs.reduce((sum, t) => sum + parseFloat(t.amount), 0);

      return {
        totalSaleAmount,
        bookType: input?.bookType || "ALL",
      };
    }),
});
