import {
  buildCorsHeaders,
  handleOptions,
  jsonResponse,
  requireAdmin
} from "../_shared/worker-utils.js";

export async function onRequest(context) {
  const { request, env } = context;

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

  const list = await env.BLOG_BRIEFS.list({ prefix: "submission:" });
  const submissions = list.keys.map((key) => ({
    id: key.name.replace("submission:", ""),
    ...key.metadata
  }));

  return jsonResponse(
    {
      count: submissions.length,
      submissions
    },
    200,
    buildCorsHeaders(request, env)
  );
}
