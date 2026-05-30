/**
 * _shared/http.ts
 * Standard HTTP response and request helpers for Edge Functions.
 */

export function json(
  status: number,
  body: any,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, any> = {},
  headers: Record<string, string> = {},
) {
  return json(
    status,
    {
      error: {
        code,
        message,
        ...extra,
      },
    },
    headers,
  );
}

export async function readJson(
  req: Request,
  headers: Record<string, string> = {},
) {
  try {
    return await req.json();
  } catch (err) {
    throw {
      response: jsonError(400, "bad_request", "Invalid JSON body", {}, headers),
    };
  }
}
