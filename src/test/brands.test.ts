import { describe, it, expect } from "vitest";
import { 
  isUuidString, 
  isStableChunkIdString,
  asChunkPK, 
  asStableChunkIdStrict, 
  asStableChunkIdLenient,
  asChunkRef, 
  asChunkRefLenient,
} from "../types/brands";

describe("Branded Type Parsing & Guards", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
  const STABLE_ID_SEQ = "C00001";
  const STABLE_ID_HASH = "H-a1b2c3d4e5f6a7b8";

  describe("isUuidString", () => {
    it("should return true for valid UUIDs", () => {
      expect(isUuidString(VALID_UUID)).toBe(true);
      expect(isUuidString(VALID_UUID.toUpperCase())).toBe(true);
    });

    it("should return false for non-UUID strings", () => {
      expect(isUuidString(STABLE_ID_SEQ)).toBe(false);
      expect(isUuidString(STABLE_ID_HASH)).toBe(false);
      expect(isUuidString("not-a-uuid")).toBe(false);
      expect(isUuidString("")).toBe(false);
    });
  });

  describe("isStableChunkIdString", () => {
    it("should return true for valid formats", () => {
      expect(isStableChunkIdString(STABLE_ID_SEQ)).toBe(true);
      expect(isStableChunkIdString(STABLE_ID_HASH)).toBe(true);
    });

    it("should return false for UUIDs", () => {
      expect(isStableChunkIdString(VALID_UUID)).toBe(false);
    });

    /**
     * Why strict? — StableChunkId is used as the stable key in .eq("chunk_id", id).
     * Allowing arbitrary strings (paths, filenames, etc.) would silently corrupt DB queries.
     * Only the two production-proven formats are allowed: C00001 and H-[16 hex chars].
     */
    it("should reject common invalid strings (paths, filenames, short strings)", () => {
      expect(isStableChunkIdString("src/index.ts")).toBe(false);
      expect(isStableChunkIdString("README.md")).toBe(false);
      expect(isStableChunkIdString("foo")).toBe(false);
      expect(isStableChunkIdString("C123")).toBe(false);   // too short
      expect(isStableChunkIdString("H-abc")).toBe(false);  // too short
      expect(isStableChunkIdString("G-00001")).toBe(false); // unknown prefix
    });
  });

  describe("asChunkPK", () => {
    it("should cast valid UUID to ChunkPK", () => {
      const pk = asChunkPK(VALID_UUID);
      expect(pk).toBe(VALID_UUID);
    });

    it("should throw for invalid UUID", () => {
      expect(() => asChunkPK(STABLE_ID_SEQ)).toThrow("Invalid ChunkPK");
    });
  });

  describe("asStableChunkIdStrict", () => {
    it("should cast valid formats to StableChunkId", () => {
      expect(asStableChunkIdStrict(STABLE_ID_SEQ)).toBe(STABLE_ID_SEQ);
      expect(asStableChunkIdStrict(STABLE_ID_HASH)).toBe(STABLE_ID_HASH);
    });

    it("should throw for UUID string", () => {
      expect(() => asStableChunkIdStrict(VALID_UUID)).toThrow("Invalid StableChunkId format");
    });

    it("should throw for invalid strings", () => {
      expect(() => asStableChunkIdStrict("foo")).toThrow("Invalid StableChunkId format");
      expect(() => asStableChunkIdStrict("README.md")).toThrow("Invalid StableChunkId format");
    });
  });

  describe("asStableChunkIdLenient", () => {
    it("should cast any string to StableChunkId (for legacy normalization only)", () => {
      expect(asStableChunkIdLenient("foo")).toBe("foo");
      expect(asStableChunkIdLenient("README.md")).toBe("README.md");
      expect(asStableChunkIdLenient(null)).toBe("");
      expect(asStableChunkIdLenient(undefined)).toBe("");
    });
  });

  describe("asChunkRef", () => {
    it("should cast any valid identifier to ChunkRef", () => {
      expect(asChunkRef(VALID_UUID)).toBe(VALID_UUID);
      expect(asChunkRef(STABLE_ID_SEQ)).toBe(STABLE_ID_SEQ);
      expect(asChunkRef(STABLE_ID_HASH)).toBe(STABLE_ID_HASH);
    });

    it("should throw for obviously invalid strings", () => {
      expect(() => asChunkRef("invalid-id-format")).toThrow("Unrecognized identifier format");
    });
  });

  describe("asChunkRefLenient", () => {
    it("should return empty string for null/undefined", () => {
      expect(asChunkRefLenient(null)).toBe("");
      expect(asChunkRefLenient(undefined)).toBe("");
    });

    it("should return valid identifier as is", () => {
      expect(asChunkRefLenient(VALID_UUID)).toBe(VALID_UUID);
      expect(asChunkRefLenient(STABLE_ID_SEQ)).toBe(STABLE_ID_SEQ);
      expect(asChunkRefLenient(STABLE_ID_HASH)).toBe(STABLE_ID_HASH);
    });

    it("should still return invalid string but as ChunkRef (backward compatibility)", () => {
      expect(asChunkRefLenient("invalid")).toBe("invalid");
    });
  });
});
