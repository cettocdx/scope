import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Client-side daily free-scan quota. A soft cost gate: every scan hits paid
 * Gemini + SerpAPI, so free users get a generous daily allowance before an
 * upgrade prompt. (A server-enforced quota comes with accounts in NEXT.)
 */
export const FREE_DAILY_SCANS = 15;

const QUOTA_KEY = "scope_scan_quota_v1";

interface QuotaState {
  date: string; // YYYY-MM-DD (local)
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function read(): Promise<QuotaState> {
  try {
    const raw = await AsyncStorage.getItem(QUOTA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuotaState;
      if (parsed.date === today()) return parsed;
    }
  } catch (e) {
    console.error("quota read failed:", e);
  }
  return { date: today(), count: 0 };
}

export async function quotaStatus(): Promise<{
  allowed: boolean;
  used: number;
  remaining: number;
}> {
  const state = await read();
  const remaining = Math.max(0, FREE_DAILY_SCANS - state.count);
  return { allowed: remaining > 0, used: state.count, remaining };
}

/** Count one scan against today's allowance. Returns the new status. */
export async function recordScan(): Promise<void> {
  const state = await read();
  const next: QuotaState = { date: today(), count: state.count + 1 };
  try {
    await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("quota write failed:", e);
  }
}
