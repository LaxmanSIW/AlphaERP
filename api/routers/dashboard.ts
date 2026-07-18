import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { findAll, findMany } from "../queries/connection";
import type { Buyer, Transaction } from "../queries/connection";
import { summarizeAllTimeAmounts } from "../lib/dashboard-metrics";

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
      const allTxs = findAll<Transaction>("transactions");
      const summary = summarizeAllTimeAmounts(allTxs, input?.bookType as "CC" | "CS" | "ALL" | undefined);

      return {
        ...summary,
        bookType: input?.bookType || "ALL",
      };
    }),

  parcelStats: publicQuery
    .input(
      z.object({
        view: z.enum(["Day", "Week", "Month", "Year"]).default("Month"),
        bookType: z.enum(["CC", "CS", "ALL"]).optional().default("ALL"),
      })
    )
    .query(async ({ input }) => {
      const { view, bookType } = input;
      const allBills = findAll<any>("bills") || [];
      const allTxs = findAll<any>("transactions").filter(t => !t.deleted);

      let filteredBills = allBills;
      if (bookType && bookType !== "ALL") {
        const matchingTxIds = new Set(
          allTxs.filter(t => t.bookType === bookType && t.billId).map(t => t.billId)
        );
        filteredBills = allBills.filter(b => matchingTxIds.has(b.id));
      }

      const chartMap = new Map<string, number>();

      if (view === "Day") {
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          chartMap.set(dateStr, 0);
        }
        for (const bill of filteredBills) {
          const bDate = bill.billDate;
          if (chartMap.has(bDate)) {
            chartMap.set(bDate, chartMap.get(bDate)! + (bill.parcel !== undefined ? (bill.parcel ?? 1) : 1));
          }
        }
      } else if (view === "Week") {
        const now = new Date();
        const weekLabels: string[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          const startOfWeek = new Date(d);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
          startOfWeek.setDate(diff);
          const label = `Wk ${String(startOfWeek.getDate()).padStart(2, "0")}/${String(startOfWeek.getMonth() + 1).padStart(2, "0")}`;
          chartMap.set(label, 0);
          weekLabels.push(label);
        }

        for (const bill of filteredBills) {
          const billTime = new Date(bill.billDate).getTime();
          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const startOfWeek = new Date(d);
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
            startOfWeek.setDate(diff);
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            if (billTime >= startOfWeek.getTime() && billTime < endOfWeek.getTime()) {
              const label = weekLabels[11 - i];
              chartMap.set(label, chartMap.get(label)! + (bill.parcel !== undefined ? (bill.parcel ?? 1) : 1));
              break;
            }
          }
        }
      } else if (view === "Month") {
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const label = d.toLocaleString("default", { month: "short" }) + " " + String(d.getFullYear()).slice(-2);
          chartMap.set(label, 0);
        }

        for (const bill of filteredBills) {
          const bDate = new Date(bill.billDate);
          const label = bDate.toLocaleString("default", { month: "short" }) + " " + String(bDate.getFullYear()).slice(-2);
          if (chartMap.has(label)) {
            chartMap.set(label, chartMap.get(label)! + (bill.parcel !== undefined ? (bill.parcel ?? 1) : 1));
          }
        }
      } else if (view === "Year") {
        const now = new Date();
        const currentYear = now.getFullYear();
        for (let i = 4; i >= 0; i--) {
          const year = currentYear - i;
          chartMap.set(String(year), 0);
        }

        for (const bill of filteredBills) {
          const bDate = new Date(bill.billDate);
          const label = String(bDate.getFullYear());
          if (chartMap.has(label)) {
            chartMap.set(label, chartMap.get(label)! + (bill.parcel !== undefined ? (bill.parcel ?? 1) : 1));
          }
        }
      }

      const chartData = Array.from(chartMap.entries()).map(([label, value]) => ({
        label,
        value,
      }));

      const totalParcelsCount = filteredBills.reduce((sum, b) => sum + (b.parcel !== undefined ? (b.parcel ?? 1) : 1), 0);

      return {
        totalParcels: totalParcelsCount,
        chartData,
      };
    }),
});
