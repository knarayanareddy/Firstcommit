/**
 * Computes SHA-256 hash for a given text.
 * Normalizes whitespace minimally: trim and normalize line endings to \n.
 */
export async function computeContentHash(text: string): Promise<string> {
  // Normalize whitespace as per expert instructions
  const normalized = text.trim().replace(/\r\n/g, "\n");

  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
/**
 * Computes a deterministic chunk_id for stable upserts.
 * Format: 'H-' + sha256(path + ':' + start_line + '-' + end_line + ':' + content_hash).slice(0, 16)
 */
export async function computeDeterministicChunkId(
  path: string,
  startLine: number,
  endLine: number,
  contentHash: string,
): Promise<string> {
  const input = `${path}:${startLine}-${endLine}:${contentHash}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fullHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `H-${fullHash.slice(0, 16)}`;
}
