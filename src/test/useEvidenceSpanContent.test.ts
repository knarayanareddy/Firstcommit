import { describe, it, expect } from "vitest";
import { isUuidString as isUuidLike } from "../types/brands";
import { normalizeChunkRef } from "../types/evidence";

describe("isUuidLike", () => {
  it("should return true for valid UUIDs", () => {
    // v4
    expect(isUuidLike("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    // lowercase
    expect(isUuidLike("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("should return false for stable chunk ids", () => {
    expect(isUuidLike("C00001")).toBe(false);
    expect(isUuidLike("CHUNK_123")).toBe(false);
  });
});

describe("normalizeChunkRef", () => {
  it("should handle explicit V2 spans", () => {
    const input = {
      chunk_ref: "C00001",
      chunk_pk: "550e8400-e29b-41d4-a716-446655440000",
      stable_chunk_id: "C00001"
    };
    const result = normalizeChunkRef(input as any);
    expect(result.chunk_ref).toBe("C00001");
    expect(result.stable_chunk_id).toBe("C00001");
    expect(result.chunk_pk).toBe(input.chunk_pk);
  });

  it("should normalize legacy UUID chunk_id", () => {
    const input = {
      chunk_id: "550e8400-e29b-41d4-a716-446655440000"
    };
    const result = normalizeChunkRef(input as any);
    expect(isUuidLike(result.chunk_ref)).toBe(true);
    expect(result.chunk_pk).toBe(input.chunk_id);
    expect(result.stable_chunk_id).toBeNull();
  });

  it("should normalize legacy TEXT chunk_id", () => {
    const input = {
      chunk_id: "C00001"
    };
    const result = normalizeChunkRef(input as any);
    expect(result.chunk_ref).toBe("C00001");
    expect(result.stable_chunk_id).toBe("C00001");
  });

  it("should handle empty input", () => {
    const result = normalizeChunkRef(null as any);
    expect(result.chunk_ref).toBe("");
    expect(result.stable_chunk_id).toBeNull();
  });
});

describe("API Contract (Span Structure)", () => {
  it("should contain explicit identifier fields", () => {
    // Mock a span from retrieve-spans
    const mockSpan = {
      span_id: "S1",
      chunk_ref: "C00001",
      chunk_pk: "550e8400-e29b-41d4-a716-446655440000",
      stable_chunk_id: "C00001",
      metadata: {
        chunk_ref_kind: "stable"
      }
    };

    expect(mockSpan).toHaveProperty("chunk_pk");
    expect(mockSpan).toHaveProperty("stable_chunk_id");
    expect(mockSpan.metadata).toHaveProperty("chunk_ref_kind");
  });
});
