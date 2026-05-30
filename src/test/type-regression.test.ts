import { describe, it, expect } from "vitest";
import { 
  StableChunkId, 
  ChunkPK, 
  PackId, 
  asChunkPK 
} from "../types/brands";
import { fetchKnowledgeChunkByStableId } from "../lib/knowledgeChunks";

/**
 * TYPE REGRESSION TESTS
 * 
 * This file is NOT imported by any runtime code. 
 * It exists solely to verify that TypeScript correctly prevents mixing
 * different branded identifier types.
 */
describe("Type Regression: Branded Identifiers", () => {
  it("statically prevents mixing ChunkPK and StableChunkId", () => {
    const packId = "550e8400-e29b-41d4-a716-446655440000" as PackId;
    const uuid = "550e8400-e29b-41d4-a716-446655440000";

    // 1) Prove we cannot assign a ChunkPK to a StableChunkId variable
    // @ts-expect-error - ChunkPK is not assignable to StableChunkId
    const badStable: StableChunkId = asChunkPK(uuid);

    // 2) Prove we cannot pass a ChunkPK to a function expecting StableChunkId
    // @ts-expect-error - Expected StableChunkId but got ChunkPK
    fetchKnowledgeChunkByStableId(packId, asChunkPK(uuid));
    
    expect(true).toBe(true);
  });
});
