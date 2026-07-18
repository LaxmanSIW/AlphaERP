// ─── User ────────────────────────────────────────────────
export interface User {
  id: number;
  unionId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
  lastSignInAt: string;
}

export type InsertUser = Omit<User, "id">;

// ─── Buyer ───────────────────────────────────────────────
export interface Buyer {
  id: number;
  companyName: string;
  contactPerson: string | null;
  phone: string | null;
  gstNumber: string | null;
  creditLimit: string;
  riskScore: string;
  address: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InsertBuyer = Omit<Buyer, "id" | "createdAt" | "updatedAt">;

// ─── Transaction ─────────────────────────────────────────
export interface Transaction {
  id: number;
  buyerId: number;
  bookType: "CC" | "CS";
  transactionDate: string;
  dueDate: string | null;
  amount: string;
  trouserQuantity: number;
  checkNumber: string | null;
  transactionType: "Sale" | "Payment_Received";
  includeInReporting: boolean;
  deleted: boolean;
  deletedReason: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InsertTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt">;

// ─── Audit Log ───────────────────────────────────────────
export interface AuditLog {
  id: number;
  tableName: string;
  recordId: number;
  action: "UPDATE" | "DELETE";
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  reason: string | null;
  userId: string | null;
  createdAt: string;
}

export type InsertAuditLog = Omit<AuditLog, "id" | "createdAt">;

// ─── Item ────────────────────────────────────────────────
export interface Item {
  id: number;
  name: string;
  hsnCode: string;
  listPrice: string;
  unit: string;
  taxPercent: string;
  createdAt: string;
  updatedAt: string;
}

export type InsertItem = Omit<Item, "id" | "createdAt" | "updatedAt">;

// ─── Bill ────────────────────────────────────────────────
export interface BillItem {
  itemId: number;
  name: string;
  hsnCode: string;
  qty: number;
  unit: string;
  listPrice: string;
  discountPercent: string;
  taxPercent: string;
  amount: string;
}

export interface Bill {
  id: number;
  billNumber: string;
  billDate: string;
  dueDate: string | null;
  buyerId: number;
  buyerName: string;
  buyerGst: string | null;
  buyerAddress: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  placeOfSupply: string;
  reverseCharge: "Yes" | "No";
  items: BillItem[];
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalTax: string;
  subtotal: string;
  discountAmount: string;
  roundOff: string;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
}

export type InsertBill = Omit<Bill, "id" | "createdAt" | "updatedAt">;

// ─── Company ─────────────────────────────────────────────
export interface Company {
  id: number;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  authorizedSignatory: string;
  terms: string[];
  createdAt: string;
  updatedAt: string;
}

export type InsertCompany = Omit<Company, "id" | "createdAt" | "updatedAt">;

