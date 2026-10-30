import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

import type {
  InsertPortfolioAsset,
  InsertUser,
  PortfolioAsset,
  User,
} from "@shared/schema";
import type { IStorage, OwnerKey } from "./storage";

/**
 * Saved-item sync on Upstash Redis (Vercel KV), used when there is no Postgres.
 * Same contract as the Postgres storage:
 *
 * - p:d:<deviceId>  hash of the device's anonymous assets (id → JSON)
 * - p:u:<userId>    hash of an account's assets
 * - u:<id>          user JSON; u:p:<provider>:<sub> and u:rc:<id> point to it
 *
 * The REST client keeps no connections open, which suits serverless.
 */

type Stored<T> = Omit<
  T,
  "dateAdded" | "updatedAt" | "createdAt" | "lastSeenAt" | "proExpiresAt"
> & {
  dateAdded?: string;
  updatedAt?: string;
  createdAt?: string;
  lastSeenAt?: string;
  proExpiresAt?: string | null;
};

/**
 * HGETALL without automatic deserialization comes back as a flat
 * [field, value, field, value…] list (or an object, depending on the client
 * version). Normalise to field → raw JSON.
 */
export function hashEntries(raw: unknown): [string, string][] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const out: [string, string][] = [];
    for (let i = 0; i + 1 < raw.length; i += 2)
      out.push([String(raw[i]), String(raw[i + 1])]);
    return out;
  }
  return Object.entries(raw as Record<string, unknown>).map(([k, v]) => [
    k,
    typeof v === "string" ? v : JSON.stringify(v),
  ]);
}

const ownerKey = (owner: OwnerKey) =>
  "userId" in owner ? `p:u:${owner.userId}` : `p:d:${owner.deviceId}`;

function toAsset(raw: unknown): PortfolioAsset {
  const a = (
    typeof raw === "string" ? JSON.parse(raw) : raw
  ) as Stored<PortfolioAsset>;
  return {
    ...a,
    dateAdded: new Date(a.dateAdded ?? Date.now()),
    updatedAt: new Date(a.updatedAt ?? Date.now()),
  } as PortfolioAsset;
}

function toUser(raw: unknown): User {
  const u = (typeof raw === "string" ? JSON.parse(raw) : raw) as Stored<User>;
  return {
    ...u,
    createdAt: new Date(u.createdAt ?? Date.now()),
    lastSeenAt: new Date(u.lastSeenAt ?? Date.now()),
    proExpiresAt: u.proExpiresAt ? new Date(u.proExpiresAt) : null,
  } as User;
}

export class RedisStorage implements IStorage {
  // Assets live in a hash per owner: ids can't collide across owners.
  readonly ownerScopedIds = true;

  private client: Redis | null = null;

  // Created on first use, so a server without KV settings still boots.
  private get redis(): Redis {
    if (this.client) return this.client;
    this.client = new Redis({
      url: (process.env.KV_REST_API_URL ??
        process.env.UPSTASH_REDIS_REST_URL) as string,
      token: (process.env.KV_REST_API_TOKEN ??
        process.env.UPSTASH_REDIS_REST_TOKEN) as string,
      automaticDeserialization: false,
    });
    return this.client;
  }

  // ---------------------------------------------------------------- users

  async getUser(id: string): Promise<User | undefined> {
    const raw = await this.redis.get<string>(`u:${id}`);
    return raw ? toUser(raw) : undefined;
  }

  private async saveUser(user: User): Promise<void> {
    await this.redis.set(`u:${user.id}`, JSON.stringify(user));
  }

  async findOrCreateUser(identity: InsertUser): Promise<User> {
    const indexKey = `u:p:${identity.provider}:${identity.providerUserId}`;
    const existingId = await this.redis.get<string>(indexKey);
    const existing = existingId ? await this.getUser(existingId) : undefined;
    if (existing) {
      // Apple only sends email/name on the first authorization: backfill.
      if (
        (identity.email && !existing.email) ||
        (identity.displayName && !existing.displayName)
      ) {
        const updated: User = {
          ...existing,
          email: existing.email ?? identity.email ?? null,
          displayName: existing.displayName ?? identity.displayName ?? null,
          lastSeenAt: new Date(),
        };
        await this.saveUser(updated);
        return updated;
      }
      return existing;
    }
    const now = new Date();
    const created: User = {
      id: randomUUID(),
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      email: identity.email ?? null,
      displayName: identity.displayName ?? null,
      isPro: false,
      proExpiresAt: null,
      revenueCatId: null,
      createdAt: now,
      lastSeenAt: now,
    };
    await this.saveUser(created);
    await this.redis.set(indexKey, created.id);
    return created;
  }

  async touchUser(id: string): Promise<void> {
    const user = await this.getUser(id);
    if (user) await this.saveUser({ ...user, lastSeenAt: new Date() });
  }

  async setPro(args: {
    userId?: string;
    revenueCatId?: string;
    isPro: boolean;
    proExpiresAt?: Date | null;
  }): Promise<void> {
    const id =
      args.userId ??
      (args.revenueCatId
        ? await this.redis.get<string>(`u:rc:${args.revenueCatId}`)
        : null);
    if (!id) return;
    const user = await this.getUser(id);
    if (!user) return;
    await this.saveUser({
      ...user,
      isPro: args.isPro,
      proExpiresAt: args.proExpiresAt ?? null,
    });
  }

  async linkRevenueCat(userId: string, revenueCatId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;
    await this.saveUser({ ...user, revenueCatId });
    await this.redis.set(`u:rc:${revenueCatId}`, userId);
  }

  // ------------------------------------------------------------ portfolio

  async getPortfolioAssets(owner: OwnerKey): Promise<PortfolioAsset[]> {
    const all = await this.redis.hgetall(ownerKey(owner));
    return hashEntries(all)
      .map(([, v]) => toAsset(v))
      .sort((a, b) => b.dateAdded.getTime() - a.dateAdded.getTime());
  }

  async getPortfolioAsset(
    id: string,
    owner: OwnerKey,
  ): Promise<PortfolioAsset | undefined> {
    const raw = await this.redis.hget<string>(ownerKey(owner), id);
    return raw ? toAsset(raw) : undefined;
  }

  async upsertPortfolioAsset(
    asset: InsertPortfolioAsset,
  ): Promise<PortfolioAsset> {
    const owner: OwnerKey = asset.userId
      ? { userId: asset.userId }
      : { deviceId: asset.deviceId };
    const id = (asset as { id?: string }).id ?? randomUUID();
    const prev = await this.getPortfolioAsset(id, owner);
    const now = new Date();
    const row = {
      currency: "USD",
      trendPercentage: 0,
      confidenceScore: 85,
      isAuthentic: true,
      history: [],
      deals: [],
      imageBase64: null,
      userId: null,
      ...prev,
      ...asset,
      id,
      dateAdded:
        prev?.dateAdded ?? (asset as { dateAdded?: Date }).dateAdded ?? now,
      updatedAt: now,
    } as PortfolioAsset;
    await this.redis.hset(ownerKey(owner), { [id]: JSON.stringify(row) });
    return row;
  }

  async updatePortfolioAsset(
    id: string,
    owner: OwnerKey,
    updates: Partial<InsertPortfolioAsset>,
  ): Promise<PortfolioAsset | undefined> {
    const prev = await this.getPortfolioAsset(id, owner);
    if (!prev) return undefined;
    const row = {
      ...prev,
      ...updates,
      id,
      updatedAt: new Date(),
    } as PortfolioAsset;
    await this.redis.hset(ownerKey(owner), { [id]: JSON.stringify(row) });
    return row;
  }

  async deletePortfolioAsset(id: string, owner: OwnerKey): Promise<boolean> {
    return (await this.redis.hdel(ownerKey(owner), id)) > 0;
  }

  async claimDeviceAssets(deviceId: string, userId: string): Promise<number> {
    const from = ownerKey({ deviceId });
    const entries = hashEntries(await this.redis.hgetall(from));
    if (!entries.length) return 0;
    const moved: Record<string, string> = {};
    for (const [id, raw] of entries) {
      const a = toAsset(raw);
      moved[id] = JSON.stringify({ ...a, userId, updatedAt: new Date() });
    }
    await this.redis.hset(ownerKey({ userId }), moved);
    await this.redis.del(from);
    return entries.length;
  }
}
