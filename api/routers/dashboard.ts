import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { db } from "../json-db/engine";

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

      const bookFilter = input?.bookType && input.bookType !== "ALL" ? `AND bookType = '${input.bookType}'` : "";

      const monthSql = `SELECT transactionType, SUM(CAST(amount AS REAL)) as totalAmount, SUM(trouserQuantity) as totalQty FROM transactions WHERE deleted = 0 AND transactionDate >= ? AND transactionDate <= ? ${bookFilter} GROUP BY transactionType`;
      const monthRows = db.prepare(monthSql).all(startOfMonth, endOfMonth) as any[];

      let totalSales = 0;
      let totalPayments = 0;
      let totalPieces = 0;

      for (const row of monthRows) {
        if (row.transactionType === "Sale") {
          totalSales += row.totalAmount;
        } else if (row.transactionType === "Payment_Received") {
          totalPayments += row.totalAmount;
        }
      }

      const piecesSql = `SELECT SUM(trouserQuantity) as totalPieces FROM transactions WHERE deleted = 0 AND transactionType = 'Sale' AND includeInReporting = 1 AND transactionDate >= ? AND transactionDate <= ? ${bookFilter}`;
      const piecesRow = db.prepare(piecesSql).get(startOfMonth, endOfMonth) as any;
      totalPieces = piecesRow?.totalPieces || 0;

      const outstandingSql = `SELECT transactionType, SUM(CAST(amount AS REAL)) as totalAmount FROM transactions WHERE deleted = 0 ${bookFilter} GROUP BY transactionType`;
      const outstandingRows = db.prepare(outstandingSql).all() as any[];
      
      let allSales = 0;
      let allPayments = 0;
      for (const row of outstandingRows) {
        if (row.transactionType === "Sale") {
          allSales += row.totalAmount;
        } else if (row.transactionType === "Payment_Received") {
          allPayments += row.totalAmount;
        }
      }

      return {
        totalSales,
        totalPayments,
        totalOutstanding: allSales - allPayments,
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
      const bookFilter = input?.bookType && input.bookType !== "ALL" ? `AND t.bookType = '${input.bookType}'` : "";
      
      const sql = `
        SELECT b.id as buyerId, b.companyName, 
               SUM(CASE WHEN t.transactionType = 'Sale' THEN CAST(t.amount AS REAL) ELSE 0 END) - 
               SUM(CASE WHEN t.transactionType = 'Payment_Received' THEN CAST(t.amount AS REAL) ELSE 0 END) as outstanding
        FROM buyers b
        JOIN transactions t ON b.id = t.buyerId
        WHERE t.deleted = 0 ${bookFilter}
        GROUP BY b.id, b.companyName
        HAVING outstanding > 0
        ORDER BY outstanding DESC
        LIMIT ?
      `;
      return db.prepare(sql).all(limit) as any[];
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

      const sql = `
        SELECT b.id as buyerId, b.companyName, SUM(CAST(t.amount AS REAL)) as totalPaid
        FROM buyers b
        JOIN transactions t ON b.id = t.buyerId
        WHERE t.deleted = 0 AND t.transactionType = 'Payment_Received' AND t.transactionDate >= ?
        GROUP BY b.id, b.companyName
        ORDER BY totalPaid DESC
        LIMIT ?
      `;
      return db.prepare(sql).all(cutoffStr, limit) as any[];
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
      
      const sql = `
        SELECT b.id as buyerId, b.companyName, SUM(t.trouserQuantity) as totalQuantity
        FROM buyers b
        JOIN transactions t ON b.id = t.buyerId
        WHERE t.deleted = 0 AND t.transactionType = 'Sale' AND t.includeInReporting = 1
        GROUP BY b.id, b.companyName
        ORDER BY totalQuantity DESC
        LIMIT ?
      `;
      return db.prepare(sql).all(limit) as any[];
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
      const bookFilter = input?.bookType && input.bookType !== "ALL" ? `AND bookType = '${input.bookType}'` : "";

      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const cutoffStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

      const sql = `
        SELECT strftime('%Y-%m', transactionDate) as monthStr, 
               SUM(CASE WHEN transactionType = 'Sale' THEN CAST(amount AS REAL) ELSE 0 END) as sales,
               SUM(CASE WHEN transactionType = 'Payment_Received' THEN CAST(amount AS REAL) ELSE 0 END) as payments
        FROM transactions
        WHERE deleted = 0 AND transactionDate >= ? ${bookFilter}
        GROUP BY monthStr
        ORDER BY monthStr ASC
      `;
      const rows = db.prepare(sql).all(cutoffStr) as any[];

      const data = [];
      const rowMap = new Map(rows.map(r => [r.monthStr, r]));

      for (let i = months - 1; i >= 0; i--) {
        const cur = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
        const row = rowMap.get(mStr) || { sales: 0, payments: 0 };
        data.push({
          month: cur.toLocaleString("default", { month: "short" }),
          year: cur.getFullYear(),
          sales: row.sales || 0,
          payments: row.payments || 0,
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
      const bookFilter = input?.bookType && input.bookType !== "ALL" ? `AND bookType = '${input.bookType}'` : "";

      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      const cutoffStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

      const sql = `
        SELECT strftime('%Y-%m', transactionDate) as monthStr, 
               SUM(trouserQuantity) as quantity
        FROM transactions
        WHERE deleted = 0 AND transactionType = 'Sale' AND includeInReporting = 1 AND transactionDate >= ? ${bookFilter}
        GROUP BY monthStr
        ORDER BY monthStr ASC
      `;
      const rows = db.prepare(sql).all(cutoffStr) as any[];

      const data = [];
      const rowMap = new Map(rows.map(r => [r.monthStr, r]));

      for (let i = months - 1; i >= 0; i--) {
        const cur = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
        const row = rowMap.get(mStr) || { quantity: 0 };
        data.push({
          month: cur.toLocaleString("default", { month: "short" }),
          year: cur.getFullYear(),
          quantity: row.quantity || 0,
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
      const bookFilter = input?.bookType && input.bookType !== "ALL" ? `AND bookType = '${input.bookType}'` : "";
      const sql = `
        SELECT 
          SUM(CASE WHEN transactionType = 'Sale' THEN CAST(amount AS REAL) ELSE 0 END) as allTimeSales,
          SUM(CASE WHEN transactionType = 'Payment_Received' THEN CAST(amount AS REAL) ELSE 0 END) as allTimePayments
        FROM transactions
        WHERE deleted = 0 ${bookFilter}
      `;
      const row = db.prepare(sql).get() as any;
      
      return {
        totalSaleAmount: row.allTimeSales || 0,
        totalPaymentAmount: row.allTimePayments || 0,
        outstanding: (row.allTimeSales || 0) - (row.allTimePayments || 0),
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
      let bookFilter = "";
      if (bookType && bookType !== "ALL") {
        bookFilter = `AND b.id IN (SELECT billId FROM transactions WHERE bookType = '${bookType}' AND billId IS NOT NULL)`;
      }

      const chartMap = new Map<string, number>();

      if (view === "Day") {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        const startStr = start.toISOString().split("T")[0];

        const sql = `SELECT billDate, SUM(COALESCE(parcel, 1)) as count FROM bills b WHERE billDate >= ? ${bookFilter} GROUP BY billDate`;
        const rows = db.prepare(sql).all(startStr) as any[];
        
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          chartMap.set(d.toISOString().split("T")[0], 0);
        }
        for (const r of rows) if (chartMap.has(r.billDate)) chartMap.set(r.billDate, r.count);

      } else if (view === "Week") {
        const now = new Date();
        const start = new Date(now.getTime() - 11 * 7 * 24 * 60 * 60 * 1000);
        const startStr = start.toISOString().split("T")[0];

        const sql = `SELECT billDate, COALESCE(parcel, 1) as parcelCount FROM bills b WHERE billDate >= ? ${bookFilter}`;
        const rows = db.prepare(sql).all(startStr) as any[];

        const weekLabels: string[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          const startOfWeek = new Date(d);
          const day = startOfWeek.getDay();
          startOfWeek.setDate(startOfWeek.getDate() - day + (day === 0 ? -6 : 1));
          const label = `Wk ${String(startOfWeek.getDate()).padStart(2, "0")}/${String(startOfWeek.getMonth() + 1).padStart(2, "0")}`;
          chartMap.set(label, 0);
          weekLabels.push(label);
        }

        for (const row of rows) {
          const billTime = new Date(row.billDate).getTime();
          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const startOfWeek = new Date(d);
            const day = startOfWeek.getDay();
            startOfWeek.setDate(startOfWeek.getDate() - day + (day === 0 ? -6 : 1));
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            if (billTime >= startOfWeek.getTime() && billTime < endOfWeek.getTime()) {
              const label = weekLabels[11 - i];
              chartMap.set(label, chartMap.get(label)! + row.parcelCount);
              break;
            }
          }
        }
      } else if (view === "Month") {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;

        const sql = `SELECT strftime('%Y-%m', billDate) as mStr, SUM(COALESCE(parcel, 1)) as count FROM bills b WHERE billDate >= ? ${bookFilter} GROUP BY mStr`;
        const rows = db.prepare(sql).all(startStr) as any[];

        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const label = d.toLocaleString("default", { month: "short" }) + " " + String(d.getFullYear()).slice(-2);
          chartMap.set(label, 0);
        }

        for (const r of rows) {
          const [y, m] = r.mStr.split('-');
          const d = new Date(parseInt(y), parseInt(m) - 1, 1);
          const label = d.toLocaleString("default", { month: "short" }) + " " + String(d.getFullYear()).slice(-2);
          if (chartMap.has(label)) chartMap.set(label, chartMap.get(label)! + r.count);
        }
      } else if (view === "Year") {
        const now = new Date();
        const startYear = now.getFullYear() - 4;
        const startStr = `${startYear}-01-01`;

        const sql = `SELECT strftime('%Y', billDate) as yStr, SUM(COALESCE(parcel, 1)) as count FROM bills b WHERE billDate >= ? ${bookFilter} GROUP BY yStr`;
        const rows = db.prepare(sql).all(startStr) as any[];

        for (let i = 4; i >= 0; i--) {
          chartMap.set(String(now.getFullYear() - i), 0);
        }
        for (const r of rows) {
          if (chartMap.has(r.yStr)) chartMap.set(r.yStr, chartMap.get(r.yStr)! + r.count);
        }
      }

      const chartData = Array.from(chartMap.entries()).map(([label, value]) => ({ label, value }));
      
      const totalSql = `SELECT SUM(COALESCE(parcel, 1)) as count FROM bills b WHERE 1=1 ${bookFilter}`;
      const totalRow = db.prepare(totalSql).get() as any;

      return {
        totalParcels: totalRow.count || 0,
        chartData,
      };
    }),
});
