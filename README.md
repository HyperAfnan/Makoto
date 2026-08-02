# Context

Evidence-based context and claim analysis for X.

## Setup

Requires Node 22+ and a network connection for the first install.

```bash
bun install
bun run typecheck
bun run test
bun run lint
bun run format:check
```

Start the backend:

```bash
bun run --cwd apps/backend dev
```

Start the extension in another terminal:

```bash
bun run --cwd apps/extension dev
```

Load the generated `.plasmo` build in Chrome, open `https://x.com`, select tweet text, and use either context-menu action.

The backend performs search and streams Week 3 analysis events. Set `GEMINI_API_KEY` to enable grounded summaries and claim reasoning; without it, the API returns an explicit deterministic fallback.

Swagger API documentation is available at `http://localhost:8787/api-docs` when `SWAGGER_ENABLED=true`.

## Search

Copy `apps/backend/.env.example`, set `BRAVE_API_KEY` or `TAVILY_API_KEY`, and restart the backend. The API searches up to three rounds, runs two queries in parallel per round, normalizes results, and removes duplicate URLs.
