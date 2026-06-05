import { users, portfolioAssets, type User, type InsertUser, type PortfolioAsset, type InsertPortfolioAsset } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getPortfolioAssets(deviceId: string): Promise<PortfolioAsset[]>;
  getPortfolioAsset(id: string, deviceId: string): Promise<PortfolioAsset | undefined>;
  createPortfolioAsset(asset: InsertPortfolioAsset): Promise<PortfolioAsset>;
  updatePortfolioAsset(id: string, deviceId: string, updates: Partial<InsertPortfolioAsset>): Promise<PortfolioAsset | undefined>;
  deletePortfolioAsset(id: string, deviceId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getPortfolioAssets(deviceId: string): Promise<PortfolioAsset[]> {
    return await db
      .select()
      .from(portfolioAssets)
      .where(eq(portfolioAssets.deviceId, deviceId))
      .orderBy(desc(portfolioAssets.dateAdded));
  }

  async getPortfolioAsset(id: string, deviceId: string): Promise<PortfolioAsset | undefined> {
    const [asset] = await db
      .select()
      .from(portfolioAssets)
      .where(and(eq(portfolioAssets.id, id), eq(portfolioAssets.deviceId, deviceId)));
    return asset || undefined;
  }

  async createPortfolioAsset(asset: InsertPortfolioAsset): Promise<PortfolioAsset> {
    const [created] = await db
      .insert(portfolioAssets)
      .values(asset)
      .onConflictDoUpdate({
        target: portfolioAssets.id,
        set: {
          itemName: asset.itemName,
          category: asset.category,
          estimatedPrice: asset.estimatedPrice,
          purchasePrice: asset.purchasePrice,
          trendPercentage: asset.trendPercentage,
          confidenceScore: asset.confidenceScore,
          investmentRating: asset.investmentRating,
          isAuthentic: asset.isAuthentic,
          history: asset.history,
          deals: asset.deals,
          imageBase64: asset.imageBase64,
          updatedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  async updatePortfolioAsset(id: string, deviceId: string, updates: Partial<InsertPortfolioAsset>): Promise<PortfolioAsset | undefined> {
    const [updated] = await db
      .update(portfolioAssets)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(portfolioAssets.id, id), eq(portfolioAssets.deviceId, deviceId)))
      .returning();
    return updated || undefined;
  }

  async deletePortfolioAsset(id: string, deviceId: string): Promise<boolean> {
    const result = await db
      .delete(portfolioAssets)
      .where(and(eq(portfolioAssets.id, id), eq(portfolioAssets.deviceId, deviceId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
