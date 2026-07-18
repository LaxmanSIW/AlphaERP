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
  Transport,
  InsertUser,
  InsertBuyer,
  InsertTransaction,
  InsertAuditLog,
  InsertItem,
  InsertBill,
  InsertCompany,
  InsertTransport,
} from "../json-db/types";
