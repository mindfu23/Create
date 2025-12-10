import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Journal entries table for sync
export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  deviceId: varchar("device_id").notNull(),
  title: text("title").notNull(), // Encrypted
  content: text("content").notNull(), // Encrypted
  checksum: varchar("checksum", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  createdAt: true,
  updatedAt: true,
});

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
