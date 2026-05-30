import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";

export interface RerankedSpan {
  id: string; // original span_id or chunk_id
  score: number; // 0-10
  reason?: string;
}

export async function batchRerankWithLLM(
  query: string,
  spans: any[],
): Promise<any[]> {
  if (!spans || spans.length === 0) return [];

  // Use platform key (LOCAL_LLM_API_KEY) and Gemini Flash for cheap infra processing
  const apiKey = Deno.env.get("LOCAL_LLM_API_KEY") ||
    Deno.env.get("GOOGLE_AI_API_KEY") ||
    Deno.env.get("OPENAI_API_KEY") || "";
  // If using Google AI key directly, use Google's OpenAI-compatible endpoint
  const isGoogleDirect = !Deno.env.get("LOCAL_LLM_API_KEY") &&
    Deno.env.get("GOOGLE_AI_API_KEY");
  const endpoint = isGoogleDirect
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : ((Deno.env.get("LOCAL_LLM_BASE_URL") || "http://ollama:11434/v1") +
      "/chat/completions");

  if (!apiKey) {
    console.warn("[RERANKER] No API key found for reranking, skipping...");
    return spans;
  }

  // 1. Pack spans for batch evaluation
  const spansToProcess = spans.slice(0, 30); // Max 30 for safety/context limits
  const spansJson = spansToProcess.map((s, idx) => ({
    index: idx,
    id: s.span_id || s.chunk_id || s.id,
    path: s.path,
    text: s.text?.slice(0, 1000), // Truncate individual spans for prompt safety
  }));

  const systemPrompt = `You are a precision RAG reranker. 
Score retrieved code/document snippets for their relevance to the user's query.
Relevance Score Scale (0-10):
- 10: Perfect match, contains the exact answer or necessary code.
- 7-9: Highly relevant, provides crucial context.
- 4-6: Partially relevant, might be useful but isn't a direct answer.
- 1-3: Tangentially related but likely noise.
- 0: Completely irrelevant.

Output ONLY a JSON array of objects: [{"id": "...", "score": 8, "reason": "..."}].
Prioritize snippets that show definitions, implementations, or specific configurations requested.`;

  const userPrompt = `Query: ${query}\n\nCandidate Snips:\n${
    JSON.stringify(spansJson, null, 2)
  }`;

  try {
    const validatedEndpoint = parseAndValidateExternalUrl(endpoint, {
      allowAnyHost: false,
      allowedHostSuffixes: ["googleapis.com"],
      allowHttps: true,
      disallowPrivateIPs: true,
    });

    const res = await fetch(validatedEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: isGoogleDirect ? "gemini-2.5-flash" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[RERANKER] API Error:", errText);

      // If local LLM endpoint 402, try Google AI key directly
      if (res.status === 402 || res.status === 429) {
        const googleKey = Deno.env.get("GOOGLE_AI_API_KEY");
        if (googleKey && !isGoogleDirect) {
          console.log("[RERANKER] Falling back to Google AI API directly");
          const googleEndpoint = parseAndValidateExternalUrl(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            {
              allowAnyHost: false,
              allowedHostSuffixes: ["googleapis.com"],
              allowHttps: true,
              disallowPrivateIPs: true,
            },
          );
          const gRes = await fetch(googleEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${googleKey}`,
            },
            body: JSON.stringify({
              model: "gemini-2.5-flash",
              messages: [{ role: "system", content: systemPrompt }, {
                role: "user",
                content: userPrompt,
              }],
              response_format: { type: "json_object" },
            }),
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            const gContent = gData.choices[0].message.content;
            const gScores: RerankedSpan[] = JSON.parse(gContent).scores ||
              JSON.parse(gContent);
            const gScoredSpans = spansToProcess.map((s) => {
              const scoreData = gScores.find((rs) =>
                rs.id === (s.span_id || s.chunk_id || s.id)
              );
              return { ...s, relevance_score: scoreData?.score || 0 };
            });
            const gFiltered = gScoredSpans.filter((s) => s.relevance_score >= 1)
              .sort((a, b) => b.relevance_score - a.relevance_score);
            const gFinal = (gFiltered.length === 0 && spansToProcess.length > 0)
              ? gScoredSpans.sort((a, b) =>
                b.relevance_score - a.relevance_score
              ).slice(0, 5)
              : gFiltered;
            console.log(
              `[RERANKER-GOOGLE] Input: ${spans.length}, Output: ${gFinal.length}`,
            );
            return gFinal;
          } else {
            console.error(
              "[RERANKER] Google fallback also failed:",
              gRes.status,
              await gRes.text(),
            );
          }
        }
      }

      return spans; // Fallback to original order
    }

    const data = await res.json();
    const content = data.choices[0].message.content;
    const scores: RerankedSpan[] = JSON.parse(content).scores ||
      JSON.parse(content); // Handle different JSON wrappers

    // 2. Map scores back to original spans and sort
    const scoredSpans = spansToProcess.map((s) => {
      const scoreData = scores.find((rs) =>
        rs.id === (s.span_id || s.chunk_id || s.id)
      );
      return { ...s, relevance_score: scoreData?.score || 0 };
    });

    // 3. Filter by relevance threshold (e.g. >= 1) and sort
    // We lowered this from 3 to 1 to be more inclusive for broad synthesis tasks.
    const filtered = scoredSpans
      .filter((s) => s.relevance_score >= 1)
      .sort((a, b) => b.relevance_score - a.relevance_score);

    // 4. Safety Fallback: If filtering is too aggressive but we had input,
    // return the top 5 ranked spans regardless of score to prevent "no evidence" failure.
    const finalSpans = (filtered.length === 0 && spansToProcess.length > 0)
      ? scoredSpans.sort((a, b) => b.relevance_score - a.relevance_score).slice(
        0,
        5,
      )
      : filtered;

    console.log(
      `[RERANKER] Input: ${spans.length}, Output: ${finalSpans.length}, Top Score: ${
        finalSpans[0]?.relevance_score
      }`,
    );
    return finalSpans;
  } catch (err) {
    console.error("[RERANKER] Fatal error:", err);
    return spans; // Graceful fallback
  }
}
