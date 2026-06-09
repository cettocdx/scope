import {
  users,
  portfolioAssets,
  type User,
  type InsertUser,
  type PortfolioAsset,
  type InsertPortfolioAsset,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNull } from "drizzle-orm";

/**
 * Who owns a portfolio asset. An authenticated request owns by `userId` and
 * syncs across devices; an anonymous request owns by `deviceId` only (and only
 * rows that have not yet been claimed by an account, i.e. userId IS NULL).
 */
export type OwnerKey = { userId: string } | { deviceId: string };

function ownerWhere(owner: OwnerKey) {
  return "userId" in owner
    ? eq(portfolioAssets.userId, owner.userId)
    : and(
        eq(portfolioAssets.deviceId, owner.deviceId),
        isNull(portfolioAssets.userId),
      );
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  findOrCreateUser(identity: InsertUser): Promise<User>;
  touchUser(id: string): Promise<void>;
  setPro(args: {
    userId?: string;
    revenueCatId?: string;
    isPro: boolean;
    proExpiresAt?: Date | null;
  }): Promise<void>;
  linkRevenueCat(userId: string, revenueCatId: string): Promise<void>;

  getPortfolioAssets(owner: OwnerKey): Promise<PortfolioAsset[]>;
  getPortfolioAsset(id: string, owner: OwnerKey): Promise<PortfolioAsset | undefined>;
  upsertPortfolioAsset(asset: InsertPortfolioAsset): Promise<PortfolioAsset>;
  updatePortfolioAsset(
    id: string,
    owner: OwnerKey,
    updates: Partial<InsertPortfolioAsset>,
  ): Promise<PortfolioAsset | undefined>;
  deletePortfolioAsset(id: string, owner: OwnerKey): Promise<boolean>;
  /** Re-home a device's anonymous assets onto an account (sign-in merge). */
  claimDeviceAssets(deviceId: string, userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async findOrCreateUser(identity: InsertUser): Promise<User> {
    const [existing] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.provider, identity.provider),
          eq(users.providerUserId, identity.providerUserId),
        ),
      );
    if (existing) {
      // Backfill email/name if the provider supplied them later (Apple only
      // returns these on the very first authorization).
      if (
        (identity.email && !existing.email) ||
        (identity.displayName && !existing.displayName)
      ) {
        const [updated] = await db
          .update(users)
          .set({
            email: existing.email ?? identity.email ?? null,
            displayName: existing.displayName ?? identity.displayName ?? null,
            lastSeenAt: new Date(),
          })
          .where(eq(users.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }

    const [created] = await db.insert(users).values(identity).returning();
    return created;
  }

  async touchUser(id: string): Promise<void> {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
  }

  async setPro(args: {
    userId?: string;
    revenueCatId?: string;
    isPro: boolean;
    proExpiresAt?: Date | null;
  }): Promise<void> {
    const set = {
      isPro: args.isPro,
      proExpiresAt: args.proExpiresAt ?? null,
    };
    if (args.userId) {
      await db.update(users).set(set).where(eq(users.id, args.userId));
    } else if (args.revenueCatId) {
      await db
        .update(users)
        .set(set)
        .where(eq(users.revenueCatId, args.revenueCatId));
    }
  }

  async linkRevenueCat(userId: string, revenueCatId: string): Promise<void> {
    await db.update(users).set({ revenueCatId }).where(eq(users.id, userId));
  }

  async getPortfolioAssets(owner: OwnerKey): Promise<PortfolioAsset[]> {
    return await db
      .select()
      .from(portfolioAssets)
      .where(ownerWhere(owner))
      .orderBy(desc(portfolioAssets.dateAdded));
  }

  async getPortfolioAsset(
    id: string,
    owner: OwnerKey,
  ): Promise<PortfolioAsset | undefined> {
    const [asset] = await db
      .select()
      .from(portfolioAssets)
      .where(and(eq(portfolioAssets.id, id), ownerWhere(owner)));
    return asset || undefined;
  }

  async upsertPortfolioAsset(asset: InsertPortfolioAsset): Promise<PortfolioAsset> {
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
          userId: asset.userId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  async updatePortfolioAsset(
    id: string,
    owner: OwnerKey,
    updates: Partial<InsertPortfolioAsset>,
  ): Promise<PortfolioAsset | undefined> {
    const [updated] = await db
      .update(portfolioAssets)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(portfolioAssets.id, id), ownerWhere(owner)))
      .returning();
    return updated || undefined;
  }

  async deletePortfolioAsset(id: string, owner: OwnerKey): Promise<boolean> {
    const result = await db
      .delete(portfolioAssets)
      .where(and(eq(portfolioAssets.id, id), ownerWhere(owner)))
      .returning();
    return result.length > 0;
  }

  async claimDeviceAssets(deviceId: string, userId: string): Promise<number> {
    const result = await db
      .update(portfolioAssets)
      .set({ userId, updatedAt: new Date() })
      .where(
        and(
          eq(portfolioAssets.deviceId, deviceId),
          isNull(portfolioAssets.userId),
        ),
      )
      .returning();
    return result.length;
  }
}

export const storage = new DatabaseStorage();
