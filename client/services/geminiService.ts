import { AssetData, Condition, Country, AssetAttributes } from "@/types";
import { getApiUrl } from "@/lib/query-client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

// AI analysis can take a while, but the AnalyzingScreen must never spin forever.
const ANALYZE_TIMEOUT_MS = 30_000;

export interface RefinementData {
  condition?: Condition;
  country?: Country;
  attributes?: AssetAttributes;
  itemName?: string;
  category?: string;
}

export async function analyzeImage(
  imageBase64: string, 
  refinements?: RefinementData
): Promise<AssetData> {
  const apiUrl = getApiUrl();
  const url = new URL("/api/analyze", apiUrl);

  const response = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageBase64,
        refinements: refinements || undefined,
      }),
    },
    ANALYZE_TIMEOUT_MS,
    "Analysis timed out, please try again",
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to analyze image");
  }

  const data = await response.json();
  return data as AssetData;
}
