import { QueryClient, QueryFunction } from "@tanstack/react-query";
import Constants from "expo-constants";

/** Local dev backend port (the Express server). Avoids macOS AirPlay on 5000. */
const DEV_API_PORT = process.env.EXPO_PUBLIC_API_PORT || "4000";

/**
 * In development, derive the dev machine's LAN IP from Expo's bundler host so a
 * physical phone can reach the Express backend running on that same machine
 * ("localhost" on the phone would point at the phone itself).
 */
function devLanBaseUrl(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } })
      .expoGoConfig?.debuggerHost ||
    "";
  const lanIp = hostUri.split(":")[0];
  return lanIp
    ? `http://${lanIp}:${DEV_API_PORT}/`
    : `http://localhost:${DEV_API_PORT}/`;
}

/**
 * Gets the base URL for the Express API server.
 * Resolution order:
 *  1. EXPO_PUBLIC_DOMAIN env (production)
 *  2. Local dev: auto-detected LAN IP + DEV_API_PORT (so phones can connect)
 * Uses http:// for localhost / LAN hosts, https:// otherwise.
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  const host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      return devLanBaseUrl();
    }
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const scheme = isLocal ? "http" : "https";

  return new URL(`${scheme}://${host}`).href;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
