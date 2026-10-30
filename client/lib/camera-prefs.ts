import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTO_KEY = "scope.camera.autoCapture";

/** Take the photo by itself once an object is locked (on by default). */
export async function autoCaptureEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(AUTO_KEY)) !== "off";
}

export async function setAutoCaptureEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_KEY, on ? "on" : "off");
}
