const PROTECTED_PREFIX = "/portals/sokimo";
const UNLOCK_PATH = "/_sokimo-unlock";
const COOKIE_NAME = "sokimo_gate";
const FIS_PROTECTED_PREFIX = "/portals/fis-rdc";
const FIS_UNLOCK_PATH = "/_fis-rdc-unlock";
const FIS_COOKIE_NAME = "fis_rdc_gate";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const FIS_RDC_REPO_API_PATH = "/api/fis-rdc/repo";
const GITHUB_API_BASE = "https://api.github.com";
const README_MAX_CHARS = 35000;
const FIS_RDC_DEFAULT_REPO_OWNER = "tise05";
const FIS_RDC_DEFAULT_REPO_NAME = "FIS-RDC";
const FIS_RDC_FALLBACK_ACCESS_CODE = "FSI.DGA.NM.01!";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === UNLOCK_PATH) {
      return handleUnlock(request, env, url);
    }

    if (url.pathname === FIS_UNLOCK_PATH) {
      return handleFisUnlock(request, env, url);
    }

    if (url.pathname === FIS_RDC_REPO_API_PATH) {
      return handleFisRdcRepoApi(request, env);
    }

    if (isProtectedPath(url.pathname)) {
      const isAuthorized = await hasValidSession(request, env);
      if (!isAuthorized) {
        const next = encodeURIComponent(`${url.pathname}${url.search}`);
        return Response.redirect(`${url.origin}${UNLOCK_PATH}?next=${next}`, 302);
      }
    }

    if (isFisProtectedPath(url.pathname)) {
      const isAuthorized = await hasValidFisSession(request, env);
      if (!isAuthorized) {
        const next = encodeURIComponent(`${url.pathname}${url.search}`);
        return Response.redirect(`${url.origin}${FIS_UNLOCK_PATH}?next=${next}`, 302);
      }
    }

    return serveAsset(request, env);
  },
};

function isProtectedPath(pathname) {
  return pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`);
}

function isFisProtectedPath(pathname) {
  return pathname === FIS_PROTECTED_PREFIX || pathname.startsWith(`${FIS_PROTECTED_PREFIX}/`);
}

async function handleUnlock(request, env, url) {
  const nextPath = sanitizeNextPathForPortal(
    url.searchParams.get("next"),
    `${PROTECTED_PREFIX}/strategic-brief-pack.html`
  );

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

  const sessionSecret = getSokimoSessionSecret(env);
  const sessionToken = await buildSessionToken(sessionSecret);
  const cookieHeader = buildSessionCookie(COOKIE_NAME, sessionToken);

  return new Response(null, {
    status: 302,
    headers: {
      Location: nextPath,
      "Set-Cookie": cookieHeader,
      "Cache-Control": "no-store",
    },
  });
}

async function handleFisUnlock(request, env, url) {
  const nextPath = sanitizeNextPathForPortal(url.searchParams.get("next"), `${FIS_PROTECTED_PREFIX}/index.html`);

  if (request.method === "GET") {
    return htmlResponse(200, renderFisUnlockPage({ nextPath }));
  }

  if (request.method !== "POST") {
    return htmlResponse(
      405,
      renderFisUnlockPage({ nextPath, errorMessage: "Method not allowed." })
    );
  }

  const submittedCode = await readSubmittedCode(request);
  const expectedCode = getFisAccessCode(env);

  if (!constantTimeEqual(submittedCode, expectedCode)) {
    return htmlResponse(
      401,
      renderFisUnlockPage({
        nextPath,
        errorMessage: "Invalid access code. Please try again.",
      })
    );
  }

  const sessionSecret = getFisSessionSecret(env);
  const sessionToken = await buildSessionToken(sessionSecret);
  const cookieHeader = buildSessionCookie(FIS_COOKIE_NAME, sessionToken);

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

async function handleFisRdcRepoApi(request, env) {
  if (request.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed. Use GET." });
  }

  const owner = sanitizeRepoPart(env.FIS_RDC_REPO_OWNER) || FIS_RDC_DEFAULT_REPO_OWNER;
  const repo = sanitizeRepoPart(env.FIS_RDC_REPO_NAME) || FIS_RDC_DEFAULT_REPO_NAME;
  const configuredBranch = sanitizeRepoPart(env.FIS_RDC_REPO_BRANCH);
  const token = String(env.FIS_RDC_GITHUB_TOKEN || "").trim();

  const repoApiUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = buildGitHubHeaders(token);

  const repoResponse = await fetch(repoApiUrl, { headers });
  if (!repoResponse.ok) {
    return githubErrorResponse(repoResponse, "Unable to load repository metadata from GitHub.");
  }

  const repoPayload = await readJson(repoResponse, {});
  const branch = configuredBranch || sanitizeRepoPart(repoPayload.default_branch) || "main";
  const warnings = [];

  const [commitsResponse, readmeResponse] = await Promise.all([
    fetch(`${repoApiUrl}/commits?sha=${encodeURIComponent(branch)}&per_page=5`, { headers }),
    fetch(`${repoApiUrl}/readme?ref=${encodeURIComponent(branch)}`, { headers }),
  ]);

  let commits = [];
  if (commitsResponse.ok) {
    const commitsPayload = await readJson(commitsResponse, []);
    commits = normalizeCommits(commitsPayload);
  } else {
    warnings.push(`Commits unavailable (HTTP ${commitsResponse.status}).`);
  }

  let readme = {
    path: "README.md",
    htmlUrl: "",
    content: "",
    truncated: false,
  };

  if (readmeResponse.ok) {
    const readmePayload = await readJson(readmeResponse, {});
    const decoded = decodeGitHubReadme(readmePayload?.content, readmePayload?.encoding);
    readme = {
      path: sanitizeRepoPart(readmePayload?.path) || "README.md",
      htmlUrl: sanitizeUrl(readmePayload?.html_url),
      content: decoded.slice(0, README_MAX_CHARS),
      truncated: decoded.length > README_MAX_CHARS,
    };
  } else if (readmeResponse.status !== 404) {
    warnings.push(`README unavailable (HTTP ${readmeResponse.status}).`);
  }

  return jsonResponse(200, {
    fetchedAt: new Date().toISOString(),
    repository: {
      owner,
      name: repo,
      fullName: sanitizeRepoPart(repoPayload.full_name) || `${owner}/${repo}`,
      description: sanitizeText(repoPayload.description),
      htmlUrl: sanitizeUrl(repoPayload.html_url),
      visibility: sanitizeRepoPart(repoPayload.visibility) || (repoPayload.private ? "private" : "public"),
      defaultBranch: sanitizeRepoPart(repoPayload.default_branch) || "",
      branch,
      pushedAt: sanitizeText(repoPayload.pushed_at),
      updatedAt: sanitizeText(repoPayload.updated_at),
      private: Boolean(repoPayload.private),
    },
    commits,
    readme,
    warnings,
  });
}

function buildGitHubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "infradev-fis-rdc-portal",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubErrorResponse(response, fallbackMessage) {
  const errorPayload = await readJson(response, {});
  const upstreamMessage =
    typeof errorPayload?.message === "string" ? errorPayload.message.trim() : "";
  const error = upstreamMessage ? `${fallbackMessage} ${upstreamMessage}` : fallbackMessage;
  return jsonResponse(response.status, {
    error,
    upstreamStatus: response.status,
    upstreamMessage,
  });
}

async function readJson(response, fallbackValue) {
  try {
    return await response.json();
  } catch {
    return fallbackValue;
  }
}

function normalizeCommits(payload) {
  if (!Array.isArray(payload)) return [];

  return payload.slice(0, 5).map((item) => {
    const sha = sanitizeRepoPart(item?.sha);
    return {
      sha,
      shortSha: sha ? sha.slice(0, 7) : "",
      message: sanitizeText(item?.commit?.message).split("\n")[0] || "No commit message",
      authorName:
        sanitizeText(item?.commit?.author?.name) ||
        sanitizeText(item?.author?.login) ||
        "Unknown",
      authoredAt: sanitizeText(item?.commit?.author?.date),
      htmlUrl: sanitizeUrl(item?.html_url),
    };
  });
}

function decodeGitHubReadme(content, encoding) {
  if (typeof content !== "string") return "";
  if (encoding !== "base64") return content;

  const normalized = content.replaceAll("\n", "");
  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function sanitizeRepoPart(value) {
  return String(value || "")
    .trim()
    .replaceAll("\r", "")
    .replaceAll("\n", "");
}

function sanitizeText(value) {
  return String(value || "").replaceAll("\r", "");
}

function sanitizeUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  if (!candidate.startsWith("https://")) return "";
  return candidate;
}

function sanitizeNextPathForPortal(candidate, fallbackPath) {
  if (!candidate) return fallbackPath;
  if (!candidate.startsWith("/")) return fallbackPath;
  if (candidate.startsWith("//")) return fallbackPath;
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

function getSokimoSessionSecret(env) {
  // Optional dedicated secret for signing session cookies.
  // Falls back to access code so setup remains one-variable simple.
  const explicitSecret = String(env.SOKIMO_SESSION_SECRET || "").trim();
  if (explicitSecret) return explicitSecret;
  return `sokimo-session::${String(env.SOKIMO_ACCESS_CODE || "").trim()}`;
}

function getFisAccessCode(env) {
  const configuredCode = String(env.FIS_RDC_ACCESS_CODE || "").trim();
  if (configuredCode) return configuredCode;
  return FIS_RDC_FALLBACK_ACCESS_CODE;
}

function getFisSessionSecret(env) {
  const explicitSecret = String(env.FIS_RDC_SESSION_SECRET || "").trim();
  if (explicitSecret) return explicitSecret;
  return `fis-rdc-session::${getFisAccessCode(env)}`;
}

async function buildSessionToken(secret) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${expiresAt}`;
  const signature = await hmacSha256Hex(secret, payload);
  return `${payload}.${signature}`;
}

async function hasValidSession(request, env) {
  return hasValidSignedSession(request, COOKIE_NAME, getSokimoSessionSecret(env));
}

async function hasValidFisSession(request, env) {
  return hasValidSignedSession(request, FIS_COOKIE_NAME, getFisSessionSecret(env));
}

async function hasValidSignedSession(request, cookieName, sessionSecret) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = readCookie(cookieHeader, cookieName);
  if (!token) return false;

  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw || "0");
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  if (!signature) return false;

  const expectedSignature = await hmacSha256Hex(sessionSecret, `${expiresAt}`);
  return constantTimeEqual(signature, expectedSignature);
}

function buildSessionCookie(cookieName, token) {
  return [
    `${cookieName}=${token}`,
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

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function renderUnlockPage({ nextPath, errorMessage = "" }) {
  return renderAccessPage({
    pageTitle: "SOKIMO Secure Access | InfraDev.Africa",
    heading: "SOKIMO Secure Access",
    description: "Enter the shared access code to open the private strategic brief.",
    submitLabel: "Open Brief",
    unlockPath: UNLOCK_PATH,
    nextPath,
    errorMessage,
  });
}

function renderFisUnlockPage({ nextPath, errorMessage = "" }) {
  return renderAccessPage({
    pageTitle: "FIS RDC Secure Access | InfraDev.Africa",
    heading: "FIS RDC Secure Access",
    description: "Enter the access code to open the private FIS RDC note.",
    submitLabel: "Open FIS Page",
    unlockPath: FIS_UNLOCK_PATH,
    nextPath,
    errorMessage,
  });
}

function renderAccessPage({
  pageTitle,
  heading,
  description,
  submitLabel,
  unlockPath,
  nextPath,
  errorMessage = "",
}) {
  const normalizedNextPath = String(nextPath || "/");
  const safeError = escapeHtml(errorMessage);
  const safeTitle = escapeHtml(pageTitle);
  const safeHeading = escapeHtml(heading);
  const safeDescription = escapeHtml(description);
  const safeSubmitLabel = escapeHtml(submitLabel);
  const safeUnlockPath = escapeHtml(unlockPath);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeTitle}</title>
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
          <h1>${safeHeading}</h1>
          <p>${safeDescription}</p>
          ${safeError ? `<div class="error">${safeError}</div>` : ""}
          <form method="POST" action="${safeUnlockPath}?next=${encodeURIComponent(normalizedNextPath)}">
            <label for="code">Access Code</label>
            <div class="input-row">
              <input id="code" name="code" type="password" autocomplete="one-time-code" required />
              <button id="toggle-code-visibility" class="toggle-visibility" type="button" aria-controls="code" aria-pressed="false">
                Show
              </button>
            </div>
            <button type="submit">${safeSubmitLabel}</button>
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
