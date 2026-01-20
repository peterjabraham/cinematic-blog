import {
  buildCorsHeaders,
  enforceCsrf,
  enforceOrigin,
  handleOptions,
  jsonResponse,
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

  if (!env?.ANTHROPIC_API_KEY) {
    return jsonResponse(
      { error: "ANTHROPIC_API_KEY is not configured" },
      500,
      buildCorsHeaders(request, env)
    );
  }

  const parsed = await parseJsonBody(request, env);
  if (parsed.error) {
    return parsed.error;
  }

  const { brief, metadata } = parsed.data || {};
  if (!brief) {
    return jsonResponse(
      { error: "Missing brief" },
      400,
      buildCorsHeaders(request, env)
    );
  }

  const article = await callClaudeForArticle(brief, metadata, env);
  return jsonResponse(
    {
      success: article.status === "generated",
      article
    },
    article.status === "generated" ? 200 : 502,
    buildCorsHeaders(request, env)
  );
}

async function callClaudeForArticle(brief, metadata, env) {
  const model = env?.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  const maxTokens = Number(env?.CLAUDE_MAX_TOKENS || 1600);
  const system = "You are a professional editor and writer. Draft a cinematic blog post using the provided brief. Use clear section headings and keep the tone consistent with the brief.";
  const user = buildPrompt(brief, metadata);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: "failed",
        model,
        error: `Claude API error: ${response.status} ${errorText}`
      };
    }

    const data = await response.json();
    const text = Array.isArray(data?.content)
      ? data.content.map((part) => part.text || "").join("").trim()
      : "";

    return {
      status: "generated",
      model,
      generated_at: new Date().toISOString(),
      output: text
    };
  } catch (error) {
    return {
      status: "failed",
      model,
      error: `Claude API request failed: ${error.message}`
    };
  }
}

function buildPrompt(brief, metadata) {
  const title = metadata?.title ? `Working Title: ${metadata.title}\n` : "";
  const tone = metadata?.tone ? `Tone: ${metadata.tone}\n` : "";
  const audience = metadata?.audience ? `Audience: ${metadata.audience}\n` : "";
  return [
    "Cinematic Blog Post Brief",
    "",
    title + audience + tone,
    brief,
    "",
    "Deliverable: A complete blog post using cinematic narrative structure (Hook, Setup, Inciting Incident, Rising Action, Climax, Resolution, Echo)."
  ].join("\n");
}
