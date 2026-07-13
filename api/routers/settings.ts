import { z } from "zod";
import { createRouter, authedQuery } from "../middleware";
import { findAll, resetNextId } from "../queries/connection";
import type { Buyer, Transaction } from "../queries/connection";

export const settingsRouter = createRouter({
  summary: authedQuery.query(() => {
    const buyers = findAll<Buyer>("buyers");
    const transactions = findAll<Transaction>("transactions").filter((tx) => !tx.deleted);
    return {
      buyerCount: buyers.length,
      transactionCount: transactions.length,
      nextBuyerId: buyers.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1,
      nextTransactionId: transactions.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1,
    };
  }),

  resetBuyerIds: authedQuery.mutation(() => {
    const nextBuyerId = resetNextId("buyers");
    return { success: true, nextBuyerId };
  }),

  resetTransactionIds: authedQuery.mutation(() => {
    const nextTransactionId = resetNextId("transactions");
    return { success: true, nextTransactionId };
  }),
});
