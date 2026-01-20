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

  if (env?.ANTHROPIC_API_KEY) {
    const claudeResult = await callClaude(submission, env);
    submission.claude = claudeResult;
  }

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
      message: "Brief submitted successfully",
      claude: submission.claude
    },
    201,
    buildCorsHeaders(request, env)
  );
}

async function callClaude(submission, env) {
  const model = env?.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  const maxTokens = Number(env?.CLAUDE_MAX_TOKENS || 1200);
  const system = "You are a professional editor and writer. Draft a cinematic blog post using the provided brief. Use clear section headings and keep the tone consistent with the brief.";
  const user = buildPrompt(submission);

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

function buildPrompt(submission) {
  const lines = [];
  lines.push("Cinematic Blog Post Brief");
  lines.push("");
  lines.push(`Topic: ${submission.topic}`);
  lines.push(`Audience: ${submission.audience}`);
  if (submission.pov) lines.push(`Point of View / Thesis: ${submission.pov}`);
  if (submission.title) lines.push(`Working Title: ${submission.title}`);
  if (submission.tone) lines.push(`Tone: ${submission.tone}`);
  if (submission.sources) lines.push(`Insights & Sources: ${submission.sources}`);
  if (submission.scenes) lines.push(`Scenes or Examples: ${submission.scenes}`);
  if (submission.length) lines.push(`Length: ${submission.length}`);
  if (submission.avoid) lines.push(`Avoid: ${submission.avoid}`);
  if (submission.brief) {
    lines.push("");
    lines.push("Full Brief:");
    lines.push(submission.brief);
  }
  lines.push("");
  lines.push("Deliverable: A complete blog post using cinematic narrative structure (Hook, Setup, Inciting Incident, Rising Action, Climax, Resolution, Echo).");
  return lines.join("\n");
}
