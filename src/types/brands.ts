/**
 * brands.ts
 * 
 * Branded types for RocketBoard identifiers to prevent accidental misuse.
 * These types are strictly strings at runtime but distinct at compile time.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

/**
 * Branded ID Types
 */
export type UUID = Brand<string, "UUID">;
export type ChunkPK = Brand<string, "ChunkPK">;           // UUID row ID
export type StableChunkId = Brand<string, "StableChunkId">; // TEXT C00001
export type ChunkRef = ChunkPK | StableChunkId;           // Union lookup key

export type PackId = Brand<string, "PackId">;
export type SourceId = Brand<string, "SourceId">;

/**
 * Strict regex for UUID v1-v5 detection
 */
export function isUuidString(s: string): s is UUID {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Matches RocketBoard stable chunk IDs (e.g., C00001, H-a1b2c3d4e5f6g7h8)
 * Sequential: C + 5 digits
 * Deterministic: H- + 16 hex characters
 */
export function isStableChunkIdString(s: string): s is StableChunkId {
  if (isUuidString(s)) return false;
  return /^(C\d{5}|H-[0-9a-f]{16})$/i.test(s);
}

/**
 * Parsing functions with runtime checks
 */

export function asChunkPK(s: string): ChunkPK {
  if (!isUuidString(s)) {
    throw new Error(`Invalid ChunkPK (not a UUID): ${s}`);
  }
  return s as unknown as ChunkPK;
}

export function asStableChunkIdStrict(s: string): StableChunkId {
  if (!isStableChunkIdString(s)) {
    throw new Error(`Invalid StableChunkId format: ${s}. Expected Sequential (C00001) or Deterministic (H-hash).`);
  }
  return s as unknown as StableChunkId;
}

/**
 * Leniently cast to StableChunkId.
 * Only use for normalizing legacy data where identifiers may not follow 
 * the modern strict regex.
 */
export function asStableChunkIdLenient(s: string | null | undefined): StableChunkId {
  return (s || "") as unknown as StableChunkId;
}

export function asPackId(s: string): PackId {
  if (!isUuidString(s)) {
    throw new Error(`Invalid PackId (not a UUID): ${s}`);
  }
  return s as unknown as PackId;
}

export function asSourceId(s: string): SourceId {
  if (!isUuidString(s)) {
    throw new Error(`Invalid SourceId (not a UUID): ${s}`);
  }
  return s as unknown as SourceId;
}

/**
 * Strict validator for ChunkRef union
 */
export function asChunkRef(s: string): ChunkRef {
  if (isUuidString(s)) return s as unknown as ChunkPK;
  if (isStableChunkIdString(s)) return s as unknown as StableChunkId;
  throw new Error(`Unrecognized identifier format (neither UUID nor Stable ID): ${s}`);
}

/**
 * Lenient validator for boundaries (normalization from legacy data)
 */
export function asChunkRefLenient(s: string | null | undefined): ChunkRef {
  const val = s || "";
  if (isUuidString(val)) return val as unknown as ChunkPK;
  // If it's not a UUID, we treat it as a Stable ID even if it doesn't match the strict pattern
  // to support legacy strings in old chat history.
  return val as unknown as StableChunkId;
}
