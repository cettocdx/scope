import AsyncStorage from "@react-native-async-storage/async-storage";

/** Set once the first-run intro has been seen (or skipped). */
const KEY = "scope_onboarded_v1";

export async function hasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return true; // never trap someone in the intro because storage failed
  }
}

export async function setOnboarded(done: boolean): Promise<void> {
  try {
    if (done) await AsyncStorage.setItem(KEY, "1");
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // best effort
  }
}
