/**
 * _shared/cors.ts
 * Centralized CORS management.
 */

export function parseAllowedOrigins() {
  const env = Deno.env.get("ALLOWED_ORIGINS") ||
    "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080";
  return env.split(",").map((o) => o.trim().replace(/\/$/, ""));
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.startsWith("192.168.") ||
      url.hostname.startsWith("10.")
    );
  } catch (_e) {
    return false;
  }
}

export function buildCorsHeaders(req: Request, allowedOrigins: string[]) {
  const origin = req.headers.get("Origin")?.replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, mcp-session-id, x-rocketboard-internal, x-supabase-auth, preferred_timezone",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
    "Access-Control-Max-Age": "86400", // 24 hours
    "Vary": "Origin",
  };

  const isStrict = Deno.env.get("STRICT_CORS") === "true";
  const rawOrigin = req.headers.get("Origin");

  if (rawOrigin) {
    if (origin && allowedOrigins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = rawOrigin;
    } else if (!isStrict && origin && isLocalOrigin(origin)) {
      // Automatically allow local origins in non-strict mode
      headers["Access-Control-Allow-Origin"] = rawOrigin;
    } else {
      console.warn(
        `[CORS] Rejected unlisted origin: ${rawOrigin} (Strict: ${isStrict})`,
      );
    }
  }

  return headers;
}

export function handleCorsPreflight(req: Request, allowedOrigins: string[]) {
  if (req.method === "OPTIONS") {
    const headers = buildCorsHeaders(req, allowedOrigins);
    return new Response(null, {
      status: 204,
      headers,
    });
  }
  return null;
}
