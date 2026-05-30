import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";

Deno.test("computeContentHash — different inputs produce different hashes", async () => {
  const hashA = await computeContentHash("hello world");
  const hashB = await computeContentHash("hello world!");
  assertNotEquals(
    hashA,
    hashB,
    "different content must produce different hashes",
  );
});

Deno.test("computeContentHash — same input is stable across calls", async () => {
  const hash1 = await computeContentHash("stable content");
  const hash2 = await computeContentHash("stable content");
  assertEquals(hash1, hash2, "same content must always produce the same hash");
});

Deno.test("computeContentHash — returns 64-char hex SHA-256", async () => {
  const hash = await computeContentHash("test");
  assertEquals(hash.length, 64, "SHA-256 hex should be 64 chars");
  assertEquals(/^[0-9a-f]{64}$/.test(hash), true, "should be lowercase hex");
});

Deno.test("computeContentHash — normalizes line endings", async () => {
  const hashLF = await computeContentHash("line1\nline2");
  const hashCRLF = await computeContentHash("line1\r\nline2");
  assertEquals(hashLF, hashCRLF, "CRLF and LF should produce identical hashes");
});

Deno.test("computeContentHash — trims whitespace", async () => {
  const hash1 = await computeContentHash("  content  ");
  const hash2 = await computeContentHash("content");
  assertEquals(
    hash1,
    hash2,
    "leading/trailing whitespace should not affect hash",
  );
});
