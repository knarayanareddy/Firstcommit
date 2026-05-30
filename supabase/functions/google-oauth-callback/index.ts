import { createServiceClient } from "../_shared/supabase-clients.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";

// CORS now handled by centralized cors.ts

// HTML page returned after OAuth completes — closes the popup and signals the parent
function successPage(email: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Connected</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#fff;">
  <h2>✅ Google Drive Connected</h2>
  <p>Connected as <strong>${email}</strong></p>
  <p>This window will close automatically...</p>
  <script>
    // Signal the parent window that auth succeeded
    if (window.opener) {
      window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', email: ${
    JSON.stringify(email)
  } }, '*');
    }
    setTimeout(() => window.close(), 1500);
  </script>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#fff;">
  <h2>❌ Connection Failed</h2>
  <p>${message}</p>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'GOOGLE_OAUTH_ERROR', error: ${
    JSON.stringify(message)
  } }, '*');
    }
    setTimeout(() => window.close(), 3000);
  </script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // user_id is passed as state
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(errorPage(`Google denied access: ${error}`), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code || !state) {
    return new Response(errorPage("Missing authorization code or state."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const CLIENT_ID = (Deno.env.get("GOOGLE_CLIENT_ID") || "").trim();
  const CLIENT_SECRET = (Deno.env.get("GOOGLE_CLIENT_SECRET") || "").trim();
  const REDIRECT_URI = (Deno.env.get("GOOGLE_REDIRECT_URI") || "").trim();

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    console.error("[OAuth] Missing required secrets:", {
      has_id: !!CLIENT_ID,
      has_secret: !!CLIENT_SECRET,
      has_redirect: !!REDIRECT_URI,
    });
    return new Response(
      errorPage("Server configuration error: Missing Google secrets."),
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error(
        `[OAuth] Google Token Exchange Failed. Status: ${tokenResp.status}`,
        errText,
      );
      let detailedError = "Failed to exchange authorization code.";
      try {
        const errJson = JSON.parse(errText);
        detailedError = `${detailedError} Google error: ${
          errJson.error_description || errJson.error || errText
        }`;
      } catch {
        detailedError = `${detailedError} Details: ${errText}`;
      }
      return new Response(errorPage(detailedError), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const tokenData = await tokenResp.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get the user's email from Google
    const userInfoResp = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      },
    );
    const userInfo = userInfoResp.ok ? await userInfoResp.json() : {};
    const email = userInfo.email || "Unknown";

    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000)
      .toISOString();

    // Store token in DB
    const serviceClient = createServiceClient();

    const { error: upsertErr } = await serviceClient
      .from("google_oauth_tokens")
      .upsert({
        user_id: state, // state = user_id passed from the frontend
        access_token,
        refresh_token,
        expires_at: expiresAt,
        scope: tokenData.scope || null,
        email,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("Failed to save token:", upsertErr);
      return new Response(
        errorPage("Failed to save Google credentials. Please try again."),
        {
          headers: { "Content-Type": "text/html" },
        },
      );
    }

    return new Response(successPage(email), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    return new Response(
      errorPage("An unexpected error occurred. Please try again."),
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  }
});
