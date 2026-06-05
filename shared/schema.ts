import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const portfolioAssets = pgTable("portfolio_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  estimatedPrice: real("estimated_price").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  purchasePrice: real("purchase_price").notNull(),
  trendPercentage: real("trend_percentage").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(85),
  investmentRating: varchar("investment_rating", { length: 10 }).notNull(),
  isAuthentic: boolean("is_authentic").notNull().default(true),
  history: jsonb("history").$type<number[]>().notNull().default([]),
  deals: jsonb("deals").$type<any[]>().default([]),
  imageBase64: text("image_base64"),
  dateAdded: timestamp("date_added").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  deviceIdx: index("idx_portfolio_device").on(table.deviceId, table.dateAdded),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPortfolioAssetSchema = createInsertSchema(portfolioAssets).omit({
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PortfolioAsset = typeof portfolioAssets.$inferSelect;
export type InsertPortfolioAsset = z.infer<typeof insertPortfolioAssetSchema>;
