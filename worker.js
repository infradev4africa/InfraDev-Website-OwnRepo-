const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "cache-control": "no-store",
};

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_SEND_URL = "https://api.resend.com/emails";
const TOKEN_TTL_SECONDS = 60 * 60 * 24;
const REPLAY_TTL_SECONDS = TOKEN_TTL_SECONDS * 14;
const MAX_NAME_LENGTH = 120;
const MAX_ORG_LENGTH = 160;
const MAX_REGION_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 2000;
const ENTRY_POINTS = new Set([
  "project_idea",
  "project_in_development",
  "project_entering_delivery",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/runtime-config") {
      if (request.method !== "GET") {
        return jsonResponse(405, { ok: false, error: "Method not allowed." });
      }
      return jsonResponse(200, {
        ok: true,
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
      });
    }

    if (url.pathname === "/api/contact/initiate") {
      if (request.method !== "POST") {
        return jsonResponse(405, { ok: false, error: "Method not allowed." });
      }
      return handleContactInitiate(request, env, url);
    }

    if (url.pathname === "/api/contact/verify") {
      if (request.method !== "GET") {
        return jsonResponse(405, { ok: false, error: "Method not allowed." });
      }
      return handleContactVerify(request, env, url);
    }

    return serveAssetWithRuntimePlaceholders(request, env);
  },
};

async function handleContactInitiate(request, env, url) {
  const wantsHtmlResponse = (request.headers.get("accept") || "").includes("text/html");
  let body;
  try {
    body = await readRequestPayload(request);
  } catch {
    return wantsHtmlResponse
      ? htmlResponse(400, renderStatusPage("Invalid Request", "The submission format is invalid."))
      : jsonResponse(400, { ok: false, error: "Invalid request body." });
  }

  const validated = validateSubmissionPayload(body);
  if (!validated.ok) {
    return wantsHtmlResponse
      ? htmlResponse(400, renderStatusPage("Invalid Request", validated.error))
      : jsonResponse(400, { ok: false, error: validated.error });
  }

  if (!env.TURNSTILE_SECRET) {
    return wantsHtmlResponse
      ? htmlResponse(500, renderStatusPage("Configuration Error", "Turnstile is not configured on the server."))
      : jsonResponse(500, { ok: false, error: "Turnstile is not configured on the server." });
  }
  if (!env.VERIFICATION_SIGNING_SECRET) {
    return wantsHtmlResponse
      ? htmlResponse(500, renderStatusPage("Configuration Error", "Verification signing secret is not configured."))
      : jsonResponse(500, { ok: false, error: "Verification signing secret is not configured." });
  }
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return wantsHtmlResponse
      ? htmlResponse(500, renderStatusPage("Configuration Error", "Email delivery service is not configured."))
      : jsonResponse(500, { ok: false, error: "Email delivery service is not configured." });
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "";
  const turnstile = await verifyTurnstileToken(validated.payload.turnstileToken, clientIp, env.TURNSTILE_SECRET);
  if (!turnstile.success) {
    return wantsHtmlResponse
      ? htmlResponse(400, renderStatusPage("Verification Failed", "Verification challenge failed. Please retry."))
      : jsonResponse(400, { ok: false, error: "Verification challenge failed. Please retry." });
  }

  const now = Date.now();
  const tokenPayload = {
    name: validated.payload.name,
    organisation: validated.payload.organisation,
    email: validated.payload.email,
    region: validated.payload.region,
    entryPoint: validated.payload.entryPoint,
    message: validated.payload.message,
    issuedAt: now,
    expiresAt: now + TOKEN_TTL_SECONDS * 1000,
  };

  const token = await createSignedToken(tokenPayload, env.VERIFICATION_SIGNING_SECRET);
  const verificationLink = `${url.origin}/api/contact/verify?token=${encodeURIComponent(token)}`;

  const verificationEmail = buildVerificationEmail(tokenPayload, verificationLink);
  await sendResendEmail(env, {
    to: [tokenPayload.email],
    subject: verificationEmail.subject,
    html: verificationEmail.html,
    text: verificationEmail.text,
    replyTo: env.LEAD_DESTINATION_EMAIL || env.EMAIL_FROM,
  });

  if (wantsHtmlResponse) {
    return Response.redirect(`${url.origin}/success.html?status=verify-email`, 302);
  }

  return jsonResponse(200, {
    ok: true,
    message: "Verification email sent. Please check your inbox.",
  });
}

async function handleContactVerify(request, env, url) {
  const token = (url.searchParams.get("token") || "").trim();
  if (!token) {
    return Response.redirect(`${url.origin}/success.html?status=invalid-token`, 302);
  }

  if (!env.VERIFICATION_SIGNING_SECRET) {
    return htmlResponse(
      500,
      renderStatusPage(
        "Configuration Error",
        "Verification is not configured correctly. Please contact info@infradev.africa."
      )
    );
  }

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return htmlResponse(
      500,
      renderStatusPage(
        "Configuration Error",
        "Email delivery is not configured. Please contact info@infradev.africa."
      )
    );
  }

  let payload;
  try {
    payload = await verifySignedToken(token, env.VERIFICATION_SIGNING_SECRET);
  } catch {
    return Response.redirect(`${url.origin}/success.html?status=invalid-token`, 302);
  }

  if (Date.now() > Number(payload.expiresAt || 0)) {
    return Response.redirect(`${url.origin}/success.html?status=expired`, 302);
  }

  const replayKey = `verified:${await sha256Hex(token)}`;
  if (env.LEADS_KV) {
    const alreadyUsed = await env.LEADS_KV.get(replayKey);
    if (alreadyUsed) {
      return Response.redirect(`${url.origin}/success.html?status=already-verified`, 302);
    }
  }

  const leadEmail = buildLeadNotificationEmail(payload, url);
  const destinationList = parseEmailList(env.LEAD_DESTINATION_EMAIL || "info@infradev.africa");
  if (destinationList.length === 0) {
    return htmlResponse(
      500,
      renderStatusPage(
        "Configuration Error",
        "Lead destination email is not configured. Please contact info@infradev.africa."
      )
    );
  }

  await sendResendEmail(env, {
    to: destinationList,
    subject: leadEmail.subject,
    html: leadEmail.html,
    text: leadEmail.text,
    replyTo: payload.email,
  });

  const receiptEmail = buildSubmitterReceiptEmail(payload);
  await sendResendEmail(env, {
    to: [payload.email],
    subject: receiptEmail.subject,
    html: receiptEmail.html,
    text: receiptEmail.text,
  });

  if (env.LEADS_KV) {
    await env.LEADS_KV.put(replayKey, String(Date.now()), { expirationTtl: REPLAY_TTL_SECONDS });
  }

  return Response.redirect(`${url.origin}/success.html?status=verified`, 302);
}

async function serveAssetWithRuntimePlaceholders(request, env) {
  if (!env.ASSETS) {
    return fetch(request);
  }

  const response = await env.ASSETS.fetch(request);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  if (!html.includes("__TURNSTILE_SITE_KEY__")) {
    const passthroughHeaders = new Headers(response.headers);
    passthroughHeaders.delete("content-length");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: passthroughHeaders,
    });
  }

  const siteKey = env.TURNSTILE_SITE_KEY || "";
  const hydratedHtml = html.replaceAll("__TURNSTILE_SITE_KEY__", siteKey);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(hydratedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function validateSubmissionPayload(input) {
  const name = sanitizeSingleLine(input?.name, MAX_NAME_LENGTH);
  const organisation = sanitizeSingleLine(input?.organisation, MAX_ORG_LENGTH);
  const email = sanitizeSingleLine(input?.email, 254).toLowerCase();
  const region = sanitizeSingleLine(input?.region, MAX_REGION_LENGTH);
  const message = sanitizeMultiline(input?.message, MAX_MESSAGE_LENGTH);
  const turnstileToken = sanitizeSingleLine(
    input?.turnstileToken || input?.["cf-turnstile-response"],
    2048
  );
  const entryPoint = sanitizeSingleLine(input?.entry_point || input?.entryPoint, 64);

  if (!name) return { ok: false, error: "Name is required." };
  if (!organisation) return { ok: false, error: "Organisation is required." };
  if (!email || !isValidEmail(email)) return { ok: false, error: "A valid email is required." };
  if (!ENTRY_POINTS.has(entryPoint)) return { ok: false, error: "Project entry point is required." };
  if (!message) return { ok: false, error: "Message is required." };
  if (!turnstileToken) return { ok: false, error: "Verification challenge is required." };

  return {
    ok: true,
    payload: { name, organisation, email, region, entryPoint, message, turnstileToken },
  };
}

async function readRequestPayload(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    const payload = {};
    for (const [key, value] of form.entries()) {
      payload[key] = typeof value === "string" ? value : "";
    }
    return payload;
  }

  throw new Error("Unsupported content type");
}

async function verifyTurnstileToken(responseToken, clientIp, secret) {
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", responseToken);
  if (clientIp) {
    body.set("remoteip", clientIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      return { success: false };
    }
    const result = await response.json();
    return { success: Boolean(result?.success) };
  } catch {
    return { success: false };
  }
}

async function sendResendEmail(env, { to, subject, html, text, replyTo }) {
  const recipients = Array.isArray(to) ? to : [to];
  const cleanedRecipients = recipients
    .map((value) => sanitizeSingleLine(value, 254))
    .filter((value) => value.length > 0);

  if (cleanedRecipients.length === 0) {
    throw new Error("No email recipients provided.");
  }

  const payload = {
    from: env.EMAIL_FROM,
    to: cleanedRecipients,
    subject,
    html,
    text,
  };
  if (replyTo) {
    payload.reply_to = sanitizeSingleLine(replyTo, 254);
  }

  const response = await fetch(RESEND_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Resend failed (${response.status}): ${bodyText}`);
  }
}

function buildVerificationEmail(payload, verificationLink) {
  const entryPointLabel = formatEntryPoint(payload.entryPoint);
  const subject = "Confirm your InfraDev enquiry";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#1e293b;">
      <h2 style="font-family:Montserrat,Arial,sans-serif;color:#0A1F44;margin-bottom:12px;">Confirm your enquiry</h2>
      <p style="line-height:1.6;">We received your request for <strong>${escapeHtml(entryPointLabel)}</strong>.</p>
      <p style="line-height:1.6;">Please confirm this email address to route your request to the InfraDev team.</p>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(verificationLink)}" style="display:inline-block;padding:12px 18px;background:#F9C70C;color:#0A1F44;text-decoration:none;font-weight:700;border-radius:6px;">Verify and Submit</a>
      </p>
      <p style="font-size:13px;color:#64748b;line-height:1.6;">If you did not submit this request, ignore this email.</p>
      <p style="font-size:13px;color:#64748b;line-height:1.6;">This link expires in 24 hours.</p>
    </div>
  `;
  const text = [
    "Confirm your InfraDev enquiry",
    "",
    `Entry point: ${entryPointLabel}`,
    `Verify and submit: ${verificationLink}`,
    "",
    "If you did not submit this request, ignore this email.",
  ].join("\n");
  return { subject, html, text };
}

function buildLeadNotificationEmail(payload, url) {
  const submittedAt = new Date(Number(payload.issuedAt || Date.now())).toISOString();
  const entryPointLabel = formatEntryPoint(payload.entryPoint);
  const subject = `[InfraDev] Verified enquiry - ${entryPointLabel}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px;color:#1e293b;">
      <h2 style="font-family:Montserrat,Arial,sans-serif;color:#0A1F44;margin-bottom:12px;">Verified enquiry received</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><strong>Name</strong></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.name)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><strong>Organisation</strong></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.organisation)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><strong>Email</strong></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.email)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><strong>Country Context</strong></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.region || "Not provided")}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><strong>Entry Point</strong></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(entryPointLabel)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><strong>Verified At</strong></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(new Date().toISOString())}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><strong>Initiated At</strong></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(submittedAt)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><strong>Source</strong></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(url.origin)}</td></tr>
        </tbody>
      </table>
      <h3 style="font-family:Montserrat,Arial,sans-serif;color:#0A1F44;margin-top:18px;">Message</h3>
      <p style="white-space:pre-wrap;line-height:1.65;border:1px solid #cbd5e1;padding:12px;border-radius:6px;">${escapeHtml(payload.message)}</p>
    </div>
  `;
  const text = [
    "Verified enquiry received",
    "",
    `Name: ${payload.name}`,
    `Organisation: ${payload.organisation}`,
    `Email: ${payload.email}`,
    `Country Context: ${payload.region || "Not provided"}`,
    `Entry Point: ${entryPointLabel}`,
    `Verified At: ${new Date().toISOString()}`,
    `Initiated At: ${submittedAt}`,
    "",
    "Message:",
    payload.message,
  ].join("\n");
  return { subject, html, text };
}

function buildSubmitterReceiptEmail(payload) {
  const subject = "InfraDev enquiry confirmed";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#1e293b;">
      <h2 style="font-family:Montserrat,Arial,sans-serif;color:#0A1F44;margin-bottom:12px;">Your enquiry is confirmed</h2>
      <p style="line-height:1.6;">Thank you. Your verified request has been routed to the InfraDev team.</p>
      <p style="line-height:1.6;">Entry point: <strong>${escapeHtml(formatEntryPoint(payload.entryPoint))}</strong></p>
      <p style="line-height:1.6;">We will respond via this email address: <strong>${escapeHtml(payload.email)}</strong></p>
    </div>
  `;
  const text = [
    "Your enquiry is confirmed.",
    `Entry point: ${formatEntryPoint(payload.entryPoint)}`,
    "Your request has been routed to the InfraDev team.",
  ].join("\n");
  return { subject, html, text };
}

async function createSignedToken(payload, secret) {
  const payloadJson = JSON.stringify(payload);
  const encodedPayload = toBase64Url(new TextEncoder().encode(payloadJson));
  const signature = await hmacSign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySignedToken(token, secret) {
  const pieces = token.split(".");
  if (pieces.length !== 2) {
    throw new Error("Invalid token format");
  }

  const [encodedPayload, signature] = pieces;
  const expectedSignature = await hmacSign(encodedPayload, secret);
  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new Error("Invalid token signature");
  }

  const payloadBytes = fromBase64Url(encodedPayload);
  const payloadText = new TextDecoder().decode(payloadBytes);
  const payload = JSON.parse(payloadText);
  return payload;
}

async function hmacSign(value, secret) {
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

async function sha256Hex(value) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function sanitizeSingleLine(value, maxLength) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, maxLength);
}

function sanitizeMultiline(value, maxLength) {
  if (typeof value !== "string") return "";
  const cleaned = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  return cleaned.slice(0, maxLength);
}

function parseEmailList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => sanitizeSingleLine(entry, 254))
    .filter((entry) => entry.length > 0 && isValidEmail(entry));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatEntryPoint(entryPoint) {
  if (entryPoint === "project_idea") return "We have a project idea";
  if (entryPoint === "project_in_development") return "We have a project in development";
  if (entryPoint === "project_entering_delivery") return "We have a project entering delivery";
  return "Not specified";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function htmlResponse(status, html) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-store",
    },
  });
}

function renderStatusPage(title, message) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)} | InfraDev.Africa</title>
        <style>
          body { margin: 0; font-family: Inter, Arial, sans-serif; background: #0A1F44; color: #F7F7F5; }
          .shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
          .card { max-width: 680px; background: #1A2538; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 28px; }
          h1 { margin: 0 0 12px; font-family: Montserrat, Arial, sans-serif; font-size: 28px; color: #F9C70C; }
          p { margin: 0; line-height: 1.65; color: #E2E8F0; }
          a { color: #F9C70C; }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="card">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(message)}</p>
            <p style="margin-top:16px;"><a href="/index.html">Return to InfraDev.Africa</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}
