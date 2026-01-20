const MAX_BODY_BYTES = 200000;
const MAX_FIELD_CHARS = 4000;

function jsonResponse(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

function getAllowedOrigins(env, request) {
  const fromEnv = env?.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];
  if (fromEnv.length > 0) {
    return fromEnv;
  }
  const url = new URL(request.url);
  return [`${url.protocol}//${url.host}`];
}

function buildCorsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env, request);
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token, Authorization"
  };
}

function handleOptions(request, env) {
  return new Response(null, {
    headers: buildCorsHeaders(request, env)
  });
}

function enforceOrigin(request, env) {
  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) {
    return null;
  }
  const allowedOrigins = getAllowedOrigins(env, request);
  if (!allowedOrigins.includes(requestOrigin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, buildCorsHeaders(request, env));
  }
  return null;
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.slice(name.length + 1));
    }
  }
  return "";
}

function enforceCsrf(request, env) {
  const csrfHeader = request.headers.get("X-CSRF-Token");
  const cookieToken = getCookieValue(request.headers.get("Cookie") || "", "csrf_token");
  if (!csrfHeader || !cookieToken || csrfHeader !== cookieToken) {
    return jsonResponse({ error: "CSRF token invalid" }, 403, buildCorsHeaders(request, env));
  }
  return null;
}

async function parseJsonBody(request, env) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    return { error: jsonResponse({ error: "Content-Type must be application/json" }, 415, buildCorsHeaders(request, env)) };
  }
  const text = await request.text();
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > MAX_BODY_BYTES) {
    return { error: jsonResponse({ error: "Payload too large" }, 413, buildCorsHeaders(request, env)) };
  }
  try {
    return { data: JSON.parse(text) };
  } catch (error) {
    return { error: jsonResponse({ error: "Invalid JSON" }, 400, buildCorsHeaders(request, env)) };
  }
}

function sanitizeString(value, maxLength = MAX_FIELD_CHARS) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).replace(/\0/g, "").trim();
  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }
  return normalized;
}

function normalizeBrief(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    id: sanitizeString(data.id, 128),
    created_at: sanitizeString(data.created_at, 64),
    status: sanitizeString(data.status, 32),
    topic: sanitizeString(data.topic),
    audience: sanitizeString(data.audience),
    pov: sanitizeString(data.pov),
    title: sanitizeString(data.title),
    tone: sanitizeString(data.tone),
    sources: sanitizeString(data.sources),
    scenes: sanitizeString(data.scenes),
    length: sanitizeString(data.length),
    avoid: sanitizeString(data.avoid),
    brief: sanitizeString(data.brief, 12000),
    metadata: {
      author_email: sanitizeString(data.metadata?.author_email),
      project_name: sanitizeString(data.metadata?.project_name)
    }
  };
}

function requireAdmin(request, env) {
  if (!env?.ADMIN_TOKEN) return null;
  const header = request.headers.get("Authorization") || "";
  const headerToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token") || "";
  if (headerToken === env.ADMIN_TOKEN || queryToken === env.ADMIN_TOKEN) {
    return null;
  }
  return jsonResponse({ error: "Unauthorized" }, 401, buildCorsHeaders(request, env));
}

export {
  buildCorsHeaders,
  enforceCsrf,
  enforceOrigin,
  handleOptions,
  jsonResponse,
  normalizeBrief,
  parseJsonBody,
  requireAdmin
};
