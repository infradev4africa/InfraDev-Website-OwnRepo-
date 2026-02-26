const PROTECTED_PREFIX = "/portals/sokimo";
const UNLOCK_PATH = "/_sokimo-unlock";
const COOKIE_NAME = "sokimo_gate";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === UNLOCK_PATH) {
      return handleUnlock(request, env, url);
    }

    if (isProtectedPath(url.pathname)) {
      const isAuthorized = await hasValidSession(request, env);
      if (!isAuthorized) {
        const next = encodeURIComponent(`${url.pathname}${url.search}`);
        return Response.redirect(`${url.origin}${UNLOCK_PATH}?next=${next}`, 302);
      }
    }

    return serveAsset(request, env);
  },
};

function isProtectedPath(pathname) {
  return pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`);
}

async function handleUnlock(request, env, url) {
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));

  if (!env.SOKIMO_ACCESS_CODE || !env.SOKIMO_ACCESS_CODE.trim()) {
    return htmlResponse(
      500,
      renderUnlockPage({
        nextPath,
        errorMessage:
          "Access code is not configured on the server. Please contact the administrator.",
      })
    );
  }

  if (request.method === "GET") {
    return htmlResponse(200, renderUnlockPage({ nextPath }));
  }

  if (request.method !== "POST") {
    return htmlResponse(405, renderUnlockPage({ nextPath, errorMessage: "Method not allowed." }));
  }

  const submittedCode = await readSubmittedCode(request);
  const expectedCode = env.SOKIMO_ACCESS_CODE.trim();

  if (!constantTimeEqual(submittedCode, expectedCode)) {
    return htmlResponse(
      401,
      renderUnlockPage({
        nextPath,
        errorMessage: "Invalid access code. Please try again.",
      })
    );
  }

  const sessionSecret = getSessionSecret(env);
  const sessionToken = await buildSessionToken(sessionSecret);
  const cookieHeader = buildSessionCookie(sessionToken);

  return new Response(null, {
    status: 302,
    headers: {
      Location: nextPath,
      "Set-Cookie": cookieHeader,
      "Cache-Control": "no-store",
    },
  });
}

async function serveAsset(request, env) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return htmlResponse(
      500,
      `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Configuration Error</title>
          <style>
            body { margin: 0; font-family: Inter, Arial, sans-serif; background: #0A1F44; color: #F7F7F5; }
            .shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
            .card { max-width: 740px; background: #1A2538; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 28px; }
            h1 { margin: 0 0 12px; font-size: 26px; color: #F9C70C; }
            p { margin: 0 0 10px; line-height: 1.6; color: #E2E8F0; }
            code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="shell">
            <div class="card">
              <h1>Static assets are not bound</h1>
              <p>The Worker is running, but <code>env.ASSETS</code> is missing.</p>
              <p>In Cloudflare, redeploy this Worker with assets enabled in <code>wrangler.jsonc</code>.</p>
            </div>
          </div>
        </body>
      </html>
      `
    );
  }

  return env.ASSETS.fetch(request);
}

function sanitizeNextPath(candidate) {
  if (!candidate) return `${PROTECTED_PREFIX}/strategic-brief-pack.html`;
  if (!candidate.startsWith("/")) return `${PROTECTED_PREFIX}/strategic-brief-pack.html`;
  if (candidate.startsWith("//")) return `${PROTECTED_PREFIX}/strategic-brief-pack.html`;
  return candidate;
}

async function readSubmittedCode(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    const payload = await request.json().catch(() => ({}));
    return sanitizeCode(payload?.code);
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData().catch(() => null);
    return sanitizeCode(form ? form.get("code") : "");
  }

  return "";
}

function sanitizeCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 256);
}

function getSessionSecret(env) {
  // Optional dedicated secret for signing session cookies.
  // Falls back to access code so setup remains one-variable simple.
  const explicitSecret = String(env.SOKIMO_SESSION_SECRET || "").trim();
  if (explicitSecret) return explicitSecret;
  return `sokimo-session::${String(env.SOKIMO_ACCESS_CODE || "").trim()}`;
}

async function buildSessionToken(secret) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${expiresAt}`;
  const signature = await hmacSha256Hex(secret, payload);
  return `${payload}.${signature}`;
}

async function hasValidSession(request, env) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = readCookie(cookieHeader, COOKIE_NAME);
  if (!token) return false;

  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw || "0");
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  if (!signature) return false;

  const expectedSignature = await hmacSha256Hex(getSessionSecret(env), `${expiresAt}`);
  return constantTimeEqual(signature, expectedSignature);
}

function buildSessionCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function readCookie(cookieHeader, cookieName) {
  const parts = cookieHeader.split(";");
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;
    const equalsIndex = part.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = part.slice(0, equalsIndex).trim();
    if (key !== cookieName) continue;
    return part.slice(equalsIndex + 1).trim();
  }
  return "";
}

async function hmacSha256Hex(secret, value) {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(secret);
  const valueBytes = encoder.encode(value);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, valueBytes);
  const bytes = new Uint8Array(signature);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function htmlResponse(status, html) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function renderUnlockPage({ nextPath, errorMessage = "" }) {
  const safeNextPath = escapeHtml(nextPath || `${PROTECTED_PREFIX}/strategic-brief-pack.html`);
  const safeError = escapeHtml(errorMessage);
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SOKIMO Secure Access | InfraDev.Africa</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <style>
          :root {
            --id-navy: #0A1F44;
            --id-gold: #F9C70C;
            --id-surface: #1A2538;
            --id-text: #E2E8F0;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Inter, Arial, sans-serif;
            background: radial-gradient(1200px 700px at 80% -10%, #1f4b89 0%, var(--id-navy) 40%, #081630 100%);
            color: var(--id-text);
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 20px;
          }
          .card {
            width: 100%;
            max-width: 460px;
            background: color-mix(in srgb, var(--id-surface) 88%, black);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 24px 60px rgba(0,0,0,0.35);
          }
          .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: var(--id-gold);
            color: var(--id-navy);
            font-weight: 900;
            margin-bottom: 12px;
          }
          h1 {
            margin: 0 0 10px;
            font-size: 22px;
            color: white;
          }
          p {
            margin: 0 0 16px;
            line-height: 1.55;
            color: #cbd5e1;
            font-size: 14px;
          }
          .error {
            margin-bottom: 12px;
            border: 1px solid rgba(248,113,113,0.45);
            background: rgba(248,113,113,0.12);
            color: #fecaca;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 13px;
          }
          label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #fde68a;
            margin-bottom: 8px;
          }
          input {
            width: 100%;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 999px;
            background: rgba(255,255,255,0.08);
            color: white;
            font-size: 16px;
            padding: 12px 14px;
            margin-bottom: 16px;
            outline: none;
          }
          input:focus {
            border-color: var(--id-gold);
            box-shadow: 0 0 0 3px rgba(249,199,12,0.2);
          }
          .input-row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 8px;
            align-items: center;
            margin-bottom: 16px;
          }
          .toggle-visibility {
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 999px;
            background: rgba(255,255,255,0.08);
            color: #e2e8f0;
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
            white-space: nowrap;
          }
          .toggle-visibility:hover {
            border-color: var(--id-gold);
            color: white;
          }
          button {
            width: 100%;
            border: 0;
            border-radius: 999px;
            padding: 12px 16px;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            background: var(--id-gold);
            color: var(--id-navy);
            cursor: pointer;
          }
          small {
            display: block;
            margin-top: 12px;
            color: #94a3b8;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <main class="card">
          <div class="badge">ID.</div>
          <h1>SOKIMO Secure Access</h1>
          <p>Enter the shared access code to open the private strategic brief.</p>
          ${safeError ? `<div class="error">${safeError}</div>` : ""}
          <form method="POST" action="${UNLOCK_PATH}?next=${encodeURIComponent(safeNextPath)}">
            <label for="code">Access Code</label>
            <div class="input-row">
              <input id="code" name="code" type="password" autocomplete="one-time-code" required />
              <button id="toggle-code-visibility" class="toggle-visibility" type="button" aria-controls="code" aria-pressed="false">
                Show
              </button>
            </div>
            <button type="submit">Open Brief</button>
          </form>
          <small>This session stays active for 12 hours on this browser.</small>
        </main>
        <script>
          (function () {
            const input = document.getElementById("code");
            const toggle = document.getElementById("toggle-code-visibility");
            if (!input || !toggle) return;

            toggle.addEventListener("click", function () {
              const nextType = input.type === "password" ? "text" : "password";
              input.type = nextType;
              const showing = nextType === "text";
              toggle.textContent = showing ? "Hide" : "Show";
              toggle.setAttribute("aria-pressed", showing ? "true" : "false");
            });
          })();
        </script>
      </body>
    </html>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
