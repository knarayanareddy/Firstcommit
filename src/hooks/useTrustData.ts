import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/trust/api";

export function useTrustSummary(packId: string, days: number = 7, useRaw: boolean = false) {
  return useQuery({
    queryKey: ["trust", "summary", packId, days, useRaw],
    queryFn: () => api.fetchTrustSummary(packId, days, useRaw),
    enabled: !!packId,
  });
}

export function useTrustTimeSeries(packId: string, days: number = 7, useRaw: boolean = false) {
  return useQuery({
    queryKey: ["trust", "timeseries", packId, days, useRaw],
    queryFn: () => api.fetchTrustTimeSeries(packId, days, useRaw),
    enabled: !!packId,
  });
}

export function useLatestRequests(packId: string, limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ["trust", "requests", packId, limit, offset],
    queryFn: () => api.fetchLatestRequests(packId, limit, offset),
    enabled: !!packId,
  });
}

export function useRequestDetail(requestId: string) {
  return useQuery({
    queryKey: ["trust", "request", requestId],
    queryFn: () => api.fetchRequestDetail(requestId),
    enabled: !!requestId,
  });
}

export function useIngestionSummary(packId: string) {
  return useQuery({
    queryKey: ["trust", "ingestion", packId],
    queryFn: () => api.fetchIngestionSummary(packId),
    enabled: !!packId,
  });
}

export function useFreshnessQueueSummary(packId: string) {
  return useQuery({
    queryKey: ["trust", "freshness-queue", packId],
    queryFn: () => api.fetchFreshnessQueueSummary(packId),
    enabled: !!packId,
  });
}
