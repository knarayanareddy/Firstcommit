import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ALL_TOURS } from "@/data/tours";
import { matchesTourRoute } from "@/lib/tour-system";
import { useRole } from "@/hooks/useRole";

const STORAGE_KEY = "rocketboard-tours-completed";

function getCompletedTours(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCompletedTours(completed: Record<string, number>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
}

const ACCESS_HIERARCHY = ["read_only", "learner", "author", "admin", "owner"];

// --- Shared module-level store so all useTour() instances share one activeTourId ---
let _activeTourId: string | null = null;
const _subscribers = new Set<() => void>();

function setSharedTourId(id: string | null) {
  _activeTourId = id;
  _subscribers.forEach((fn) => fn());
}
// ---------------------------------------------------------------------------------

export function useTour() {
  const location = useLocation();
  const { packAccessLevel } = useRole();
  const [, forceUpdate] = useState(0);
  const lastTourTime = useRef(0);
  const mountTime = useRef(Date.now());

  // Subscribe/unsubscribe on mount/unmount
  useEffect(() => {
    const notify = () => forceUpdate((n) => n + 1);
    _subscribers.add(notify);
    return () => { _subscribers.delete(notify); };
  }, []);

  const shouldShowTour = useCallback((tourId: string): boolean => {
    const completed = getCompletedTours();
    return !completed[tourId];
  }, []);

  const completeTour = useCallback((tourId: string) => {
    const completed = getCompletedTours();
    completed[tourId] = Date.now();
    saveCompletedTours(completed);
    lastTourTime.current = Date.now();
    setSharedTourId(null);
  }, []);

  const resetTour = useCallback((tourId: string) => {
    const completed = getCompletedTours();
    delete completed[tourId];
    saveCompletedTours(completed);
  }, []);

  const resetAllTours = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const getCurrentPageTour = useCallback(() => {
    return ALL_TOURS.find((tour) => {
      if (!matchesTourRoute(tour, location.pathname)) return false;
      if (tour.requiredRole) {
        const userIdx = ACCESS_HIERARCHY.indexOf(packAccessLevel);
        const reqIdx = ACCESS_HIERARCHY.indexOf(tour.requiredRole);
        if (userIdx < reqIdx) return false;
      }
      return true;
    }) || null;
  }, [location.pathname, packAccessLevel]);

  const startTour = useCallback((tourId: string) => {
    setSharedTourId(tourId);
  }, []);

  // Clear the active tour whenever the route changes so it doesn't bleed into the next page
  useEffect(() => {
    setSharedTourId(null);
  }, [location.pathname]);

  // Auto-trigger tour on page visit (2s delay)
  useEffect(() => {
    mountTime.current = Date.now();
    const timer = setTimeout(() => {
      // Don't show if user navigated away quickly
      const elapsed = Date.now() - mountTime.current;
      if (elapsed < 1800) return;

      // Don't show back-to-back tours
      if (Date.now() - lastTourTime.current < 5000) return;

      // Don't show during onboarding wizard
      if (location.pathname.includes("/onboarding")) return;

      // Don't override a manually started tour
      if (_activeTourId) return;

      const tour = getCurrentPageTour();
      if (tour && shouldShowTour(tour.id)) {
        setSharedTourId(tour.id);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [location.pathname, getCurrentPageTour, shouldShowTour]);

  const activeTourId = _activeTourId;
  const activeTour = activeTourId
    ? ALL_TOURS.find((t) => t.id === activeTourId) || null
    : null;

  return {
    activeTour,
    activeTourId,
    shouldShowTour,
    completeTour,
    resetTour,
    resetAllTours,
    startTour,
    getCurrentPageTour,
    setActiveTourId: setSharedTourId,
  };
}
