import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  decimal,
  int,
  boolean,
  date,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const buyers = mysqlTable("buyers", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  gstNumber: varchar("gst_number", { length: 15 }),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }).default("0.00"),
  riskScore: decimal("risk_score", { precision: 3, scale: 1 }).default("5.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Buyer = typeof buyers.$inferSelect;
export type InsertBuyer = typeof buyers.$inferInsert;

export const transactions = mysqlTable("transactions", {
  id: serial("id").primaryKey(),
  buyerId: bigint("buyer_id", { mode: "number", unsigned: true }).notNull(),
  bookType: mysqlEnum("book_type", ["CC", "CS"]).default("CC").notNull(),
  transactionDate: date("transaction_date").notNull(),
  dueDate: date("due_date"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  trouserQuantity: int("trouser_quantity").default(0),
  checkNumber: varchar("check_number", { length: 50 }),
  transactionType: mysqlEnum("transaction_type", ["Sale", "Payment_Received"]).notNull(),
  includeInReporting: boolean("include_in_reporting").default(true),
  deleted: boolean("deleted").default(false),
  deletedReason: text("deleted_reason"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export const auditLogs = mysqlTable("audit_logs", {
  id: serial("id").primaryKey(),
  tableName: varchar("table_name", { length: 50 }).notNull(),
  recordId: bigint("record_id", { mode: "number", unsigned: true }).notNull(),
  action: mysqlEnum("action", ["UPDATE", "DELETE"]).notNull(),
  oldValues: json("old_values"),
  newValues: json("new_values"),
  reason: text("reason"),
  userId: varchar("user_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
