import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

/**
 * Account session management. The provider sign-in (Apple/Google) happens in
 * the UI layer; this service exchanges the provider identity token for a SCOPE
 * session token and persists it. The token is also held in memory so non-React
 * code (portfolioService) can attach it without an async read on every call.
 */

const TOKEN_KEY = "scope_auth_token_v1";
const USER_KEY = "scope_auth_user_v1";
const AUTH_TIMEOUT_MS = 15_000;

export interface AccountUser {
  id: string;
  email: string | null;
  displayName: string | null;
  isPro: boolean;
  proExpiresAt?: string | null;
}

let inMemoryToken: string | null = null;

export function getAuthTokenSync(): string | null {
  return inMemoryToken;
}

export async function loadStoredAuth(): Promise<{
  token: string | null;
  user: AccountUser | null;
}> {
  try {
    const [token, userRaw] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    inMemoryToken = token;
    return {
      token,
      user: userRaw ? (JSON.parse(userRaw) as AccountUser) : null,
    };
  } catch {
    return { token: null, user: null };
  }
}

async function persist(token: string, user: AccountUser): Promise<void> {
  inMemoryToken = token;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearStoredAuth(): Promise<void> {
  inMemoryToken = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

interface AuthResponse {
  token: string;
  user: AccountUser;
  claimed?: number;
}

async function exchange(
  provider: "apple" | "google",
  body: { idToken: string; displayName?: string; deviceId?: string },
): Promise<AuthResponse> {
  const url = new URL(`/api/auth/${provider}`, getApiUrl());
  const res = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    AUTH_TIMEOUT_MS,
    "Sign-in timed out",
  );
  if (!res.ok) {
    let msg = "Sign-in failed";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as AuthResponse;
  await persist(data.token, data.user);
  return data;
}

export function signInWithAppleToken(args: {
  idToken: string;
  displayName?: string;
  deviceId?: string;
}): Promise<AuthResponse> {
  return exchange("apple", args);
}

export function signInWithGoogleToken(args: {
  idToken: string;
  deviceId?: string;
}): Promise<AuthResponse> {
  return exchange("google", args);
}

/** Re-fetch the account + Pro entitlement using the stored session token. */
export async function fetchMe(): Promise<AccountUser | null> {
  if (!inMemoryToken) return null;
  try {
    const url = new URL("/api/auth/me", getApiUrl());
    const res = await fetchWithTimeout(
      url.toString(),
      { headers: { Authorization: `Bearer ${inMemoryToken}` } },
      AUTH_TIMEOUT_MS,
    );
    if (res.status === 401) {
      await clearStoredAuth();
      return null;
    }
    if (!res.ok) return null;
    const user = (await res.json()) as AccountUser;
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}
