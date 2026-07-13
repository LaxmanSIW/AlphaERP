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
