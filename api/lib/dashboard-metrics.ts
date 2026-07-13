import type { Transaction } from "../queries/connection";

export function summarizeAllTimeAmounts(transactions: Transaction[], bookType?: "CC" | "CS" | "ALL") {
  const bookFilter = bookType && bookType !== "ALL"
    ? (t: Transaction) => t.bookType === bookType
    : () => true;

  const allTxs = transactions.filter((t) => !t.deleted).filter(bookFilter);

  const totalSaleAmount = allTxs
    .filter((t) => t.transactionType === "Sale")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalPaymentAmount = allTxs
    .filter((t) => t.transactionType === "Payment_Received")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return {
    totalSaleAmount,
    totalPaymentAmount,
    bookType: bookType || "ALL",
  };
}
