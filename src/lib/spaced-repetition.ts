/** SM-2 inspired spaced repetition scheduling */

const BASE_INTERVALS = [3, 7, 14, 30, 60];

export function calculateNextReview(reviewCount: number, selfRating: number): number {
  // selfRating: 1=forgot, 2=hard, 3=good, 4=easy
  const baseIdx = Math.min(reviewCount, BASE_INTERVALS.length - 1);
  const baseDays = BASE_INTERVALS[baseIdx];
  
  const multiplier = selfRating <= 1 ? 0.5 : selfRating === 2 ? 0.75 : selfRating === 3 ? 1 : 1.5;
  return Math.max(1, Math.round(baseDays * multiplier));
}

export function getNextReviewDate(reviewCount: number, selfRating: number): Date {
  const days = calculateNextReview(reviewCount, selfRating);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
