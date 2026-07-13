import { relations } from "drizzle-orm";
import { buyers, transactions } from "./schema";

export const buyersRelations = relations(buyers, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  buyer: one(buyers, {
    fields: [transactions.buyerId],
    references: [buyers.id],
  }),
}));
