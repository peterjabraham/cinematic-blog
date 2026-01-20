import {
  buildCorsHeaders,
  enforceCsrf,
  enforceOrigin,
  handleOptions,
  jsonResponse,
  normalizeBrief,
  parseJsonBody
} from "../_shared/worker-utils.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return handleOptions(request, env);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, buildCorsHeaders(request, env));
  }

  const originError = enforceOrigin(request, env);
  if (originError) {
    return originError;
  }

  const csrfError = enforceCsrf(request, env);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseJsonBody(request, env);
  if (parsed.error) {
    return parsed.error;
  }

  const normalized = normalizeBrief(parsed.data);
  if (!normalized.topic || !normalized.audience) {
    return jsonResponse(
      { error: "Missing required fields: topic and audience" },
      400,
      buildCorsHeaders(request, env)
    );
  }

  if (!env?.BLOG_BRIEFS) {
    return jsonResponse(
      { error: "KV binding BLOG_BRIEFS is not configured" },
      500,
      buildCorsHeaders(request, env)
    );
  }

  const id = normalized.id || crypto.randomUUID();
  const createdAt = normalized.created_at || new Date().toISOString();
  const submission = {
    ...normalized,
    id,
    created_at: createdAt,
    status: "submitted"
  };

  await env.BLOG_BRIEFS.put(
    `submission:${id}`,
    JSON.stringify(submission),
    {
      metadata: {
        topic: submission.topic,
        audience: submission.audience,
        title: submission.title,
        created_at: createdAt
      }
    }
  );

  return jsonResponse(
    {
      success: true,
      id,
      message: "Brief submitted successfully"
    },
    201,
    buildCorsHeaders(request, env)
  );
}
