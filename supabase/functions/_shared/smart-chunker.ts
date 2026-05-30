/**
 * Shared smart chunking utilities for RocketBoard.
 * Prioritizes document structure (headings) for high-quality retrieval.
 */

interface ChunkOptions {
  maxWords?: number;
  overlapWords?: number;
}

/**
 * Splits Markdown content by headings (H1-H6).
 * Groups sections together until maxWords is reached.
 * If a single section exceeds maxWords, it is further split using the fallback chunker.
 */
export function chunkMarkdownByHeadings(
  markdown: string,
  options: ChunkOptions = {},
): { start: number; end: number; text: string }[] {
  const { maxWords = 500, overlapWords = 50 } = options;

  // Regex to split by headings while keeping the headings
  // Supports both # and underline styles (though # is preferred in our normalizers)
  const headingRegex = /^(\#{1,6}\s+.*)$/m;
  const parts = markdown.split(headingRegex);

  const sections: string[] = [];
  let currentSection = "";

  for (const part of parts) {
    if (headingRegex.test(part)) {
      // It's a heading.
      // If we have content in currentSection, and the new addition would exceed maxWords,
      // we push the current section and start a new one.
      if (currentSection && countWords(currentSection + part) > maxWords) {
        sections.push(currentSection.trim());
        currentSection = part;
      } else {
        currentSection += part;
      }
    } else {
      // It's content
      currentSection += part;
    }
  }
  if (currentSection) sections.push(currentSection.trim());

  const finalChunks: { start: number; end: number; text: string }[] = [];
  let lineCursor = 1;

  for (const section of sections) {
    const wordCount = countWords(section);
    if (wordCount > maxWords) {
      // This section is too big, split it with overlap
      const subChunks = fallbackChunkWords(section, { maxWords, overlapWords });
      for (const sub of subChunks) {
        finalChunks.push({
          start: lineCursor + sub.start - 1,
          end: lineCursor + sub.end - 1,
          text: sub.text,
        });
      }
    } else if (wordCount > 0) {
      const lines = section.split("\n").length;
      finalChunks.push({
        start: lineCursor,
        end: lineCursor + lines - 1,
        text: section,
      });
    }
    lineCursor += section.split("\n").length;
  }

  return finalChunks;
}

/**
 * Standard word-count based chunker with overlap.
 * Used as a fallback when no headings are present or a section is too large.
 */
export function fallbackChunkWords(
  text: string,
  options: ChunkOptions = {},
): { start: number; end: number; text: string }[] {
  const { maxWords = 500, overlapWords = 50 } = options;
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: { start: number; end: number; text: string }[] = [];

  if (words.length === 0) return [];

  let i = 0;
  let lineEstimate = 1;
  const allLines = text.split("\n");

  while (i < words.length) {
    const end = Math.min(i + maxWords, words.length);
    const chunkWords = words.slice(i, end);
    const chunkText = chunkWords.join(" ");

    // Find approximate line range in the original text
    // This is a heuristic since we're splitting by words
    const linesInChunk = chunkText.split("\n").length;

    chunks.push({
      start: lineEstimate,
      end: lineEstimate + linesInChunk - 1,
      text: chunkText,
    });

    if (end === words.length) break;

    // Advance by (maxWords - overlap)
    const step = Math.max(1, maxWords - overlapWords);
    i += step;

    // Update line estimate based on the step
    const stepText = words.slice(i - step, i).join(" ");
    lineEstimate += stepText.split("\n").length - 1;
  }

  return chunks;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
