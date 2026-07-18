import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { findAll, findById, insert, update, remove, count } from "../queries/connection";
import type { Buyer, Transaction } from "../queries/connection";

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
      let items = findAll<Buyer>("buyers");
      const allTxs = findAll<Transaction>("transactions").filter(t => !t.deleted);

      // Apply search
      if (input?.search) {
        const searchLower = input.search.toLowerCase();
        items = items.filter(b => b.companyName.toLowerCase().includes(searchLower));
      }

      // Sort
      items.sort((a, b) => {
        if (input?.sortOrder === "desc") {
          return b.companyName.localeCompare(a.companyName);
        }
        return a.companyName.localeCompare(b.companyName);
      });

      const total = items.length;

      const allBills = findAll<any>("bills") || [];

      // Calculate outstanding for each buyer
      const itemsWithStats = items.map(buyer => {
        const buyerTxs = allTxs.filter(t => t.buyerId === buyer.id);
        const totalSales = buyerTxs
          .filter(t => t.transactionType === "Sale")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalPaid = buyerTxs
          .filter(t => t.transactionType === "Payment_Received")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const buyerBills = allBills.filter(b => b.buyerId === buyer.id);
        const totalParcels = buyerBills.reduce((sum, b) => sum + (b.parcel !== undefined ? (b.parcel ?? 1) : 1), 0);

        return {
          ...buyer,
          totalSales,
          totalPaid,
          outstanding: totalSales - totalPaid,
          totalParcels,
        };
      });

      return {
        items: itemsWithStats,
        total,
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
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().optional(),
        defaultTransportId: z.number().nullable().optional(),
        defaultTransportName: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();
      const result = insert<Buyer>("buyers", {
        companyName: input.companyName,
        contactPerson: input.contactPerson || null,
        phone: input.phone || null,
        gstNumber: input.gstNumber || null,
        creditLimit: input.creditLimit.toFixed(2),
        address: input.address || null,
        city: input.city || null,
        state: input.state || null,
        stateCode: input.stateCode || null,
        defaultTransportId: input.defaultTransportId || null,
        defaultTransportName: input.defaultTransportName || null,
        riskScore: "5.0",
        createdAt: now,
        updatedAt: now,
      });

      return { id: result.id, message: "Buyer created successfully" };
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
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().optional(),
        defaultTransportId: z.number().nullable().optional(),
        defaultTransportName: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;

      const updateValues: Partial<Buyer> = {};
      if (updateData.companyName !== undefined) updateValues.companyName = updateData.companyName;
      if (updateData.contactPerson !== undefined) updateValues.contactPerson = updateData.contactPerson || null;
      if (updateData.phone !== undefined) updateValues.phone = updateData.phone || null;
      if (updateData.gstNumber !== undefined) updateValues.gstNumber = updateData.gstNumber || null;
      if (updateData.creditLimit !== undefined) updateValues.creditLimit = updateData.creditLimit.toFixed(2);
      if (updateData.address !== undefined) updateValues.address = updateData.address || null;
      if (updateData.city !== undefined) updateValues.city = updateData.city || null;
      if (updateData.state !== undefined) updateValues.state = updateData.state || null;
      if (updateData.stateCode !== undefined) updateValues.stateCode = updateData.stateCode || null;
      if (updateData.defaultTransportId !== undefined) updateValues.defaultTransportId = updateData.defaultTransportId;
      if (updateData.defaultTransportName !== undefined) updateValues.defaultTransportName = updateData.defaultTransportName;
      updateValues.updatedAt = new Date().toISOString();

      const result = update<Buyer>("buyers", id, updateValues);
      if (!result) throw new Error("Buyer not found");

      return { id, message: "Buyer updated successfully" };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const allTxs = findAll<Transaction>("transactions");
      const txCount = allTxs.filter(t => t.buyerId === input.id).length;

      if (txCount > 0) {
        throw new Error("Cannot delete buyer with existing transactions");
      }

      const success = remove<Buyer>("buyers", input.id);
      if (!success) throw new Error("Buyer not found");

      return { message: "Buyer deleted successfully" };
    }),

  detail: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const buyer = findById<Buyer>("buyers", input.id);
      if (!buyer) {
        throw new Error("Buyer not found");
      }

      const allTxs = findAll<Transaction>("transactions").filter(t => !t.deleted && t.buyerId === input.id);

      const totalSales = allTxs
        .filter(t => t.transactionType === "Sale")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalPaid = allTxs
        .filter(t => t.transactionType === "Payment_Received")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      return {
        ...buyer,
        totalSales,
        totalPaid,
        outstanding: totalSales - totalPaid,
        transactionCount: allTxs.length,
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
      const buyer = findById<Buyer>("buyers", input.id);
      if (!buyer) {
        throw new Error("Buyer not found");
      }

      let txItems = findAll<Transaction>("transactions").filter(
        t => !t.deleted && t.buyerId === input.id
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
        buyer,
        openingBalance: 0,
        items,
        closingBalance: balance,
      };
    }),

  riskAnalysis: publicQuery
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let allBuyers = findAll<Buyer>("buyers");

      if (input?.search) {
        const searchLower = input.search.toLowerCase();
        allBuyers = allBuyers.filter(b => b.companyName.toLowerCase().includes(searchLower));
      }

      const allTxs = findAll<Transaction>("transactions").filter(t => !t.deleted);
      const result = [];

      for (const buyer of allBuyers) {
        const buyerTxs = allTxs.filter(t => t.buyerId === buyer.id);
        const totalSales = buyerTxs
          .filter(t => t.transactionType === "Sale")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalPaid = buyerTxs
          .filter(t => t.transactionType === "Payment_Received")
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const outstanding = totalSales - totalPaid;

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

        result.push({
          buyer,
          totalSales,
          totalPaid,
          outstanding,
          riskScore,
          riskLevel,
          utilization,
        });
      }

      return result;
    }),

  bulkCreate: publicQuery
    .input(
      z.object({
        buyers: z.array(
          z.object({
            companyName: z.string().min(1),
            contactPerson: z.string().optional(),
            phone: z.string().optional(),
            gstNumber: z.string().optional(),
            creditLimit: z.number().min(0).default(0),
            address: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            stateCode: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      let imported = 0;
      let failed = 0;
      const errors: Array<{ row: number; message: string }> = [];
      const now = new Date().toISOString();

      for (let i = 0; i < input.buyers.length; i++) {
        const buyer = input.buyers[i];
        try {
          insert<Buyer>("buyers", {
            companyName: buyer.companyName.trim(),
            contactPerson: buyer.contactPerson || null,
            phone: buyer.phone || null,
            gstNumber: buyer.gstNumber || null,
            creditLimit: (buyer.creditLimit || 0).toFixed(2),
            address: buyer.address || null,
            city: buyer.city || null,
            state: buyer.state || null,
            stateCode: buyer.stateCode || null,
            riskScore: "5.0",
            createdAt: now,
            updatedAt: now,
          });
          imported++;
        } catch (err: any) {
          failed++;
          errors.push({ row: i + 1, message: err.message || "Unknown error" });
        }
      }

      return { imported, failed, errors };
    }),
});
