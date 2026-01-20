# Cinematic Blog Brief (Cloudflare Pages)

Single-page cinematic blog brief builder with Cloudflare Pages Functions + KV storage.

## Structure

```
cinematic-blog/
├── public/
│   └── index.html
├── functions/
│   ├── _shared/
│   │   └── worker-utils.js
│   └── api/
│       ├── submit.js
│       ├── submissions.js
│       └── submission/
│           └── [id].js
├── docs/
│   ├── cinematic-blog-implementation-plan.md
│   └── cinematic-blog-bundle.zip
├── skills/
│   └── cinematic-blog.skill
└── wrangler.toml
```

## Cloudflare Pages Setup

1. Create a GitHub repo and push this folder as the repo root.
2. In Cloudflare Pages, create a new project from the GitHub repo.
3. Settings:
   - Build command: *(none)*
   - Build output directory: `public`
   - Functions directory: `functions`

## KV Binding

This app expects a KV namespace bound as `BLOG_BRIEFS`.

`wrangler.toml` includes a placeholder binding. Replace the `id` with your namespace ID.

```
[[kv_namespaces]]
binding = "BLOG_BRIEFS"
id = "REPLACE_WITH_NAMESPACE_ID"
```

## Environment Variables (optional)

- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for POSTs.
  - If unset, defaults to the current Pages origin.
- `ADMIN_TOKEN`: If set, required for listing and fetching submissions.
- `ANTHROPIC_API_KEY`: If set, the Worker calls Claude on submit and stores the draft.
- `CLAUDE_MODEL`: Optional override (default: `claude-3-5-sonnet-20241022`).
- `CLAUDE_MAX_TOKENS`: Optional override (default: `1200`).

## Endpoints

- `POST /api/submit` → store a submission
- `GET /api/submissions` → list submissions (requires `ADMIN_TOKEN` if set)
- `GET /api/submission/:id` → fetch a submission (requires `ADMIN_TOKEN` if set)

When `ANTHROPIC_API_KEY` is set, `POST /api/submit` also returns a `claude` object
and stores it inside the submission.

### Example (Claude/web_fetch)

```
GET https://<your-pages-domain>/api/submission/<id>?token=<ADMIN_TOKEN>
```

## Local Dev (optional)

```
wrangler pages dev public --compatibility-date=2025-01-01
```

