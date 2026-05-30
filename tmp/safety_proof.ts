import { PackId, ChunkPK, StableChunkId, asPackId, asChunkPK, asStableChunkId } from "./src/types/brands";

// @ts-expect-error: Cannot assign PackId to ChunkPK
const pk: ChunkPK = asPackId("550e8400-e29b-41d4-a716-446655440000");

function fetchByStableId(id: StableChunkId) {
  return id;
}

const myPk = asChunkPK("f47ac10b-58cc-4372-a567-0e02b2c3d479");
// @ts-expect-error: Argument of type 'ChunkPK' is not assignable to parameter of type 'StableChunkId'
fetchByStableId(myPk);
