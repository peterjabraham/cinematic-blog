# Cinematic Blog Post Generator — Implementation Plan

## Overview

This package provides two components that work together:

1. **Claude Skill** (`cinematic-blog.skill`) — Enables the cinematic blog post workflow directly within Claude
2. **Web Form** (`cinematic-blog-form.html`) — Captures structured briefs that can be pasted into Claude or stored via Cloudflare

---

## Architecture Options

### Option A: Simple (Form → Copy/Paste)

```
┌─────────────────┐     ┌─────────────────┐
│   Web Form      │────▶│   Copy Brief    │────▶ Paste into Claude
│  (Static HTML)  │     │   to Clipboard  │
└─────────────────┘     └─────────────────┘
```

**Pros:** No backend, instant setup, works anywhere  
**Cons:** Manual copy/paste step

### Option B: Cloudflare (Form → Storage → Review)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Form      │────▶│ Cloudflare      │────▶│    KV Storage   │
│  (Pages)        │     │ Worker          │     │    (Briefs)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Review/Export  │
                                              │  Dashboard      │
                                              └─────────────────┘
```

**Pros:** Persistent storage, submission tracking, team access  
**Cons:** Requires Cloudflare account setup

---

## Deployment Guide

### Step 1: Deploy the Claude Skill

1. Locate `cinematic-blog.skill` in this package
2. Go to Claude.ai → Settings → Skills
3. Click "Add Skill" and upload the `.skill` file
4. The skill is now active — trigger it by asking Claude to write a blog post using cinematic structure

**Trigger phrases:**
- "Write a cinematic blog post about..."
- "Use the cinematic narrative structure to write..."
- "/cinematic [topic]"

---

### Step 2a: Deploy Web Form (GitHub Pages — Simple)

1. Create a new GitHub repository (e.g., `blog-brief-form`)
2. Upload `cinematic-blog-form.html` as `index.html`
3. Go to Settings → Pages → Enable GitHub Pages from main branch
4. Access at: `https://yourusername.github.io/blog-brief-form/`

---

### Step 2b: Deploy Web Form (Cloudflare Pages — Recommended)

#### Initial Setup

1. Create a Cloudflare account at https://dash.cloudflare.com
2. Go to Workers & Pages → Create Application → Pages
3. Connect your GitHub repo OR use Direct Upload
4. Upload `cinematic-blog-form.html` as `index.html`

#### Add Storage (Optional)

1. Go to Workers & Pages → KV → Create Namespace
2. Name it `BLOG_BRIEFS`
3. Go to your Pages project → Settings → Functions → KV Namespace Bindings
4. Add binding: Variable name = `BRIEFS`, KV Namespace = `BLOG_BRIEFS`

#### Deploy the Worker

1. Go to Workers & Pages → Create Application → Worker
2. Name it `blog-brief-api`
3. Paste contents of `cinematic-blog-worker.js`
4. Go to Settings → Variables → KV Namespace Bindings
5. Add binding: Variable name = `BRIEFS`, KV Namespace = `BLOG_BRIEFS`
6. Deploy

#### Connect Form to Worker

Update the form's `WORKER_URL` constant:

```javascript
const WORKER_URL = 'https://blog-brief-api.YOUR-SUBDOMAIN.workers.dev';
```

---

## File Manifest

| File | Purpose |
|------|---------|
| `cinematic-blog.skill` | Claude skill package — upload to Claude settings |
| `cinematic-blog-form.html` | Single-file web form — deploy to any static host |
| `cinematic-blog-worker.js` | Cloudflare Worker — optional backend for storage |
| `cinematic-blog-implementation-plan.md` | This document |

---

## Using the Skill in Claude

Once installed, you can use the skill in several ways:

### Method 1: Direct Request
```
Write a cinematic blog post about remote work burnout. 
Take the angle that companies are measuring productivity wrong.
```

### Method 2: With Brief
```
/cinematic

TOPIC: The death of the traditional job interview
POINT OF VIEW: AI is making interviews obsolete faster than HR realizes
AUDIENCE: HR leaders and hiring managers
TONE: Provocative
```

### Method 3: Paste Form Output
Copy the generated brief from the web form and paste directly into Claude.

---

## Customization

### Adding Custom Tones

Edit the form's tone options:

```html
<option value="scholarly">Scholarly / academic</option>
<option value="irreverent">Irreverent / witty</option>
```

### Modifying the Structure

The skill uses this 7-part structure by default:
1. Hook (Cold Open)
2. Setup
3. Inciting Incident
4. Rising Action
5. Climax / Turning Point
6. Resolution
7. Echo (Closing Image)

To modify, edit the skill's `references/structure.md` file.

---

## Troubleshooting

**Skill not triggering?**
- Ensure it's enabled in Claude settings
- Use explicit trigger: "/cinematic" or mention "cinematic structure"

**Form not submitting?**
- Check browser console for errors
- Verify WORKER_URL is correct (if using Cloudflare)
- Confirm KV binding is configured

**Worker returning 500?**
- Check Worker logs in Cloudflare dashboard
- Verify KV namespace binding name matches code

---

## Support

For issues with:
- **Claude Skill**: Check Anthropic documentation at docs.anthropic.com
- **Cloudflare**: Check Cloudflare Workers documentation at developers.cloudflare.com
