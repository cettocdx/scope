import { AssetData } from "@/types";
import { getApiUrl } from "@/lib/query-client";

export async function analyzeImage(imageBase64: string): Promise<AssetData> {
  const apiUrl = getApiUrl();
  const url = new URL("/api/analyze", apiUrl);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: imageBase64 }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to analyze image");
  }

  const data = await response.json();
  return data as AssetData;
}
