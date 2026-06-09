import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";

/**
 * Authentication for SCOPE accounts.
 *
 * Flow:
 *  1. The app performs Sign in with Apple / Google natively and obtains an
 *     identity token (a JWT signed by the provider).
 *  2. The app posts that token to /api/auth/{apple,google}. We verify the
 *     signature against the provider's public keys and read the stable `sub`.
 *  3. We mint our OWN short-lived-ish session JWT (HS256, signed with
 *     SESSION_SECRET) which the app then sends as `Authorization: Bearer ...`.
 *
 * No password is ever stored. Provider tokens are verified, never trusted blindly.
 */

const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_TTL = "60d";

// Apple: bundle identifier is the audience. Allow a comma-separated list so the
// same backend can serve the iOS app + (later) an Android/services client id.
const APPLE_AUDIENCES = (process.env.APPLE_BUNDLE_ID || "com.scope.assetvision")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Google: the OAuth client id(s) the id_token may be issued for (iOS client,
// web client used by expo-auth-session, etc).
const GOOGLE_AUDIENCES = (process.env.GOOGLE_CLIENT_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export interface ProviderIdentity {
  provider: "apple" | "google";
  providerUserId: string;
  email?: string;
}

function secretKey(): Uint8Array {
  if (!SESSION_SECRET || SESSION_SECRET.length < 16) {
    throw new Error(
      "SESSION_SECRET is not set (or too short). Set a 32+ char random string.",
    );
  }
  return new TextEncoder().encode(SESSION_SECRET);
}

/** Verify an Apple identity token and extract the stable user identity. */
export async function verifyAppleToken(idToken: string): Promise<ProviderIdentity> {
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience: APPLE_AUDIENCES,
  });
  if (!payload.sub) throw new Error("Apple token missing sub");
  return {
    provider: "apple",
    providerUserId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

/** Verify a Google id_token and extract the stable user identity. */
export async function verifyGoogleToken(idToken: string): Promise<ProviderIdentity> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    // If no client ids are configured we still verify signature + issuer; the
    // audience check is skipped (dev convenience). Configure GOOGLE_CLIENT_IDS
    // in production so tokens minted for other apps are rejected.
    audience: GOOGLE_AUDIENCES.length ? GOOGLE_AUDIENCES : undefined,
  });
  if (!payload.sub) throw new Error("Google token missing sub");
  return {
    provider: "google",
    providerUserId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

/** Mint a SCOPE session token for a verified account. */
export async function issueSession(userId: string): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer("scope")
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey());
}

async function readSession(token: string): Promise<string | null> {
  try {
    const { payload }: { payload: JWTPayload } = await jwtVerify(
      token,
      secretKey(),
      { issuer: "scope" },
    );
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function bearer(req: Request): string | null {
  const h = req.header("authorization") || req.header("Authorization");
  if (!h) return null;
  const [scheme, value] = h.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value : null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/** Populate req.userId when a valid session token is present; never blocks. */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = bearer(req);
  if (token) {
    const userId = await readSession(token);
    if (userId) req.userId = userId;
  }
  next();
}

/** Require a valid session; 401 otherwise. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = bearer(req);
  const userId = token ? await readSession(token) : null;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.userId = userId;
  next();
}
