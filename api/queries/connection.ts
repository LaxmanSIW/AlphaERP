import { seedDatabase } from "../json-db/engine";

// Initialize seed data on first import
seedDatabase();

// Re-export all JSON DB operations
export {
  findAll,
  findById,
  findOne,
  findMany,
  insert,
  update,
  remove,
  count,
  resetNextId,
} from "../json-db/engine";

export type {
  User,
  Buyer,
  Transaction,
  AuditLog,
  Item,
  Bill,
  Company,
  InsertUser,
  InsertBuyer,
  InsertTransaction,
  InsertAuditLog,
  InsertItem,
  InsertBill,
  InsertCompany,
} from "../json-db/types";
