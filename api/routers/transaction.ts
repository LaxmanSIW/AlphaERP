import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { findAll, findById, insert, update, count } from "../queries/connection";
import type { Buyer, Transaction, AuditLog } from "../queries/connection";

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
        noPagination: z.boolean().optional().default(false),
      }).optional()
    )
    .query(async ({ input }) => {
      const allBuyers = findAll<Buyer>("buyers");
      let items = findAll<Transaction>("transactions")
        .filter(t => !t.deleted)
        .map(t => {
          const buyer = allBuyers.find(b => b.id === t.buyerId);
          return {
            id: t.id,
            buyerId: t.buyerId,
            companyName: buyer?.companyName || "Unknown",
            bookType: t.bookType,
            transactionDate: t.transactionDate,
            dueDate: t.dueDate,
            amount: t.amount,
            trouserQuantity: t.trouserQuantity,
            checkNumber: t.checkNumber,
            transactionType: t.transactionType,
            includeInReporting: t.includeInReporting,
            createdAt: t.createdAt,
          };
        });

      // Apply filters
      if (input?.bookType && input.bookType !== "ALL") {
        items = items.filter(t => t.bookType === input.bookType);
      }
      if (input?.transactionType && input.transactionType !== "ALL") {
        items = items.filter(t => t.transactionType === input.transactionType);
      }
      if (input?.startDate) {
        items = items.filter(t => t.transactionDate >= input.startDate!);
      }
      if (input?.endDate) {
        items = items.filter(t => t.transactionDate <= input.endDate!);
      }
      if (input?.buyerId) {
        items = items.filter(t => t.buyerId === input.buyerId);
      }

      // Sort by date desc
      items.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

      const total = items.length;

      return { items, total };
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
      const now = new Date().toISOString();

      const result = insert<Transaction>("transactions", {
        buyerId: input.buyerId,
        bookType: input.bookType,
        transactionDate: txDate,
        dueDate,
        amount: input.amount.toFixed(2),
        trouserQuantity: input.trouserQuantity,
        checkNumber: input.checkNumber || null,
        transactionType: input.transactionType,
        includeInReporting: input.includeInReporting,
        deleted: false,
        deletedReason: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      return { id: result.id, message: "Transaction created successfully" };
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
      const { id, ...updateData } = input;

      const oldTransaction = findById<Transaction>("transactions", id);
      if (!oldTransaction || oldTransaction.deleted) {
        throw new Error("Transaction not found");
      }

      // Lock rules for bill-linked transactions
      if (oldTransaction.billId) {
        const attemptedKeys = Object.keys(updateData).filter(
          (k) => updateData[k as keyof typeof updateData] !== undefined && k !== "includeInReporting"
        );
        if (attemptedKeys.length > 0) {
          throw new Error("This transaction is linked to a bill. Only 'Include in Reporting' can be updated directly; other fields are locked and can only be modified through the bill itself.");
        }
      }

      const updateValues: Partial<Transaction> = {};
      if (updateData.buyerId !== undefined) updateValues.buyerId = updateData.buyerId;
      if (updateData.bookType !== undefined) updateValues.bookType = updateData.bookType;
      if (updateData.transactionDate !== undefined) updateValues.transactionDate = updateData.transactionDate;
      if (updateData.dueDate !== undefined) updateValues.dueDate = updateData.dueDate || null;
      if (updateData.amount !== undefined) updateValues.amount = updateData.amount.toFixed(2);
      if (updateData.trouserQuantity !== undefined) updateValues.trouserQuantity = updateData.trouserQuantity;
      if (updateData.checkNumber !== undefined) updateValues.checkNumber = updateData.checkNumber || null;
      if (updateData.transactionType !== undefined) updateValues.transactionType = updateData.transactionType;
      if (updateData.includeInReporting !== undefined) updateValues.includeInReporting = updateData.includeInReporting;
      updateValues.updatedAt = new Date().toISOString();

      const result = update<Transaction>("transactions", id, updateValues);
      if (!result) throw new Error("Transaction not found");

      // Create audit log
      insert<AuditLog>("auditLogs", {
        tableName: "transactions",
        recordId: id,
        action: "UPDATE",
        oldValues: oldTransaction as unknown as Record<string, unknown>,
        newValues: updateValues as unknown as Record<string, unknown>,
        userId: "system",
        reason: null,
        createdAt: new Date().toISOString(),
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
      const oldTransaction = findById<Transaction>("transactions", input.id);
      if (!oldTransaction || oldTransaction.deleted) {
        throw new Error("Transaction not found");
      }

      // Check if transaction was created by a bill
      if (oldTransaction.billId) {
        throw new Error("This transaction was automatically created by a bill and cannot be deleted directly. It will be removed automatically if you delete or update the corresponding bill.");
      }

      const result = update<Transaction>("transactions", input.id, {
        deleted: true,
        deletedReason: input.reason,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!result) throw new Error("Transaction not found");

      // Create audit log
      insert<AuditLog>("auditLogs", {
        tableName: "transactions",
        recordId: input.id,
        action: "DELETE",
        oldValues: oldTransaction as unknown as Record<string, unknown>,
        newValues: null,
        userId: "system",
        reason: input.reason,
        createdAt: new Date().toISOString(),
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
      let imported = 0;
      let failed = 0;
      let newBuyers = 0;
      const errors: Array<{ row: number; message: string }> = [];

      const buyerCache = new Map<string, number>();
      const allBuyers = findAll<Buyer>("buyers");
      const now = new Date().toISOString();

      for (let i = 0; i < input.transactions.length; i++) {
        const tx = input.transactions[i];
        try {
          let buyerId: number;
          const cacheKey = tx.buyerName.toLowerCase().trim();

          if (buyerCache.has(cacheKey)) {
            buyerId = buyerCache.get(cacheKey)!;
          } else {
            const existingBuyer = allBuyers.find(
              b => b.companyName.toLowerCase().trim() === cacheKey
            );

            if (existingBuyer) {
              buyerId = existingBuyer.id;
            } else {
              const result = insert<Buyer>("buyers", {
                companyName: tx.buyerName.trim(),
                contactPerson: null,
                phone: null,
                gstNumber: null,
                creditLimit: "0.00",
                riskScore: "5.0",
                address: null,
                city: null,
                state: null,
                stateCode: null,
                createdAt: now,
                updatedAt: now,
              });
              buyerId = result.id;
              allBuyers.push(result);
              newBuyers++;
            }
            buyerCache.set(cacheKey, buyerId);
          }

          // Parse date
          let txDate: string;
          const dateStr = tx.transactionDate.trim();
          if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            txDate = `${year}-${month}-${day}`;
          } else {
            txDate = dateStr;
          }

          let dueDate: string | null = null;
          if (tx.dueDate?.trim()) {
            const dueStr = tx.dueDate.trim();
            if (dueStr.includes("/")) {
              const parts = dueStr.split("/");
              const day = parts[0].padStart(2, "0");
              const month = parts[1].padStart(2, "0");
              const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              dueDate = `${year}-${month}-${day}`;
            } else {
              dueDate = dueStr;
            }
          }

          insert<Transaction>("transactions", {
            buyerId,
            bookType: tx.bookType,
            transactionDate: txDate,
            dueDate,
            amount: tx.amount.toFixed(2),
            trouserQuantity: tx.quantity,
            checkNumber: tx.checkNumber || null,
            transactionType: tx.transactionType,
            includeInReporting: tx.includeInReporting,
            deleted: false,
            deletedReason: null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          });

          imported++;
        } catch (err: any) {
          failed++;
          errors.push({ row: i + 1, message: err.message || "Unknown error" });
        }
      }

      return { imported, failed, newBuyers, errors };
    }),
});
