import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PortfolioAsset } from "@/types";
import {
  addAssetToPortfolio,
  getLocalPortfolio,
  removeAssetFromPortfolio,
  syncPortfolio,
} from "@/services/portfolioService";

/** Single cache key for the user's portfolio — the one source of truth. */
export const PORTFOLIO_KEY = ["portfolio"] as const;

/**
 * Reads the portfolio through React Query. The query itself resolves instantly
 * from local storage; a cloud sync runs in the background on mount and whenever
 * the screen regains focus, writing the reconciled result back into the cache
 * so every screen sharing PORTFOLIO_KEY updates at once.
 */
export function usePortfolio() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: PORTFOLIO_KEY,
    queryFn: getLocalPortfolio,
    staleTime: Infinity,
  });

  const sync = useCallback(() => {
    syncPortfolio()
      .then((merged) => qc.setQueryData(PORTFOLIO_KEY, merged))
      .catch((e) => console.error("Portfolio sync failed:", e));
  }, [qc]);

  // Refetch from the cloud each time a screen comes into focus, replacing the
  // hand-rolled navigation focus listeners the screens used to carry.
  useFocusEffect(
    useCallback(() => {
      sync();
    }, [sync]),
  );

  return { ...query, assets: query.data ?? [], sync };
}

/**
 * Adds an asset with an optimistic cache update; the underlying service writes
 * local storage and queues the cloud upsert (retried offline).
 */
export function useAddAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: addAssetToPortfolio,
    onMutate: async (asset: PortfolioAsset) => {
      await qc.cancelQueries({ queryKey: PORTFOLIO_KEY });
      const prev = qc.getQueryData<PortfolioAsset[]>(PORTFOLIO_KEY) ?? [];
      qc.setQueryData<PortfolioAsset[]>(PORTFOLIO_KEY, [
        asset,
        ...prev.filter((a) => a.id !== asset.id),
      ]);
      return { prev };
    },
    onError: (_err, _asset, ctx) => {
      if (ctx?.prev) qc.setQueryData(PORTFOLIO_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
  });
}

/** Removes an asset with an optimistic cache update; cloud delete is queued. */
export function useRemoveAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: removeAssetFromPortfolio,
    onMutate: async (assetId: string) => {
      await qc.cancelQueries({ queryKey: PORTFOLIO_KEY });
      const prev = qc.getQueryData<PortfolioAsset[]>(PORTFOLIO_KEY) ?? [];
      qc.setQueryData<PortfolioAsset[]>(
        PORTFOLIO_KEY,
        prev.filter((a) => a.id !== assetId),
      );
      return { prev };
    },
    onError: (_err, _assetId, ctx) => {
      if (ctx?.prev) qc.setQueryData(PORTFOLIO_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
  });
}
