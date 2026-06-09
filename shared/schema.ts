import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * A single store offer / deal for an item. Defined here (rather than importing
 * from server/) so the jsonb column type below can reference it without a
 * circular import between shared and server code.
 */
export interface Deal {
  storeName: string;
  price: number;
  currency: string;
  url: string;
  region: string;
  isBestDeal?: boolean;
  isOutlier?: boolean;
  /** True when this is a "search on X" link rather than a real priced offer. */
  isSearchLink?: boolean;
  qualityScore?: number;
  priceUSD?: number;
  originalPrice?: number;
  originalCurrency?: string;
  thumbnail?: string;
}

/**
 * An authenticated account. Created on first Sign in with Apple / Google. We
 * store only the provider's stable subject id + minimal profile; never a
 * password. `isPro` mirrors the active RevenueCat entitlement.
 */
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // "apple" | "google"
  provider: varchar("provider", { length: 16 }).notNull(),
  // The provider's stable subject identifier (Apple `sub`, Google `sub`).
  providerUserId: varchar("provider_user_id").notNull(),
  email: text("email"),
  displayName: text("display_name"),
  // Pro entitlement, kept in sync via the RevenueCat webhook.
  isPro: boolean("is_pro").notNull().default(false),
  proExpiresAt: timestamp("pro_expires_at"),
  // RevenueCat App User ID linked to this account (for reconciliation).
  revenueCatId: varchar("revenuecat_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
}, (table) => ({
  providerIdx: index("idx_users_provider").on(table.provider, table.providerUserId),
}));

export const portfolioAssets = pgTable("portfolio_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // Anonymous owner key. Pre-sign-in assets are owned by the device; on
  // sign-in they are re-homed to the account (see `userId`).
  deviceId: varchar("device_id").notNull(),
  // When set, the asset belongs to an account and syncs across that account's
  // devices. NULL means it is still device-only (anonymous).
  userId: varchar("user_id"),
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
  deals: jsonb("deals").$type<Deal[]>().default([]),
  imageBase64: text("image_base64"),
  dateAdded: timestamp("date_added").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  deviceIdx: index("idx_portfolio_device").on(table.deviceId, table.dateAdded),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  provider: true,
  providerUserId: true,
  email: true,
  displayName: true,
});

export const insertPortfolioAssetSchema = createInsertSchema(portfolioAssets).omit({
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PortfolioAsset = typeof portfolioAssets.$inferSelect;
export type InsertPortfolioAsset = z.infer<typeof insertPortfolioAssetSchema>;
