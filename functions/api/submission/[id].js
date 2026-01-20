import {
  buildCorsHeaders,
  handleOptions,
  jsonResponse,
  requireAdmin
} from "../../_shared/worker-utils.js";

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === "OPTIONS") {
    return handleOptions(request, env);
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, buildCorsHeaders(request, env));
  }

  const authError = requireAdmin(request, env);
  if (authError) {
    return authError;
  }

  if (!env?.BLOG_BRIEFS) {
    return jsonResponse(
      { error: "KV binding BLOG_BRIEFS is not configured" },
      500,
      buildCorsHeaders(request, env)
    );
  }

  const id = params?.id;
  if (!id) {
    return jsonResponse({ error: "Missing submission id" }, 400, buildCorsHeaders(request, env));
  }

  const data = await env.BLOG_BRIEFS.get(`submission:${id}`);
  if (!data) {
    return jsonResponse({ error: "Submission not found" }, 404, buildCorsHeaders(request, env));
  }

  return new Response(data, {
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(request, env)
    }
  });
}
